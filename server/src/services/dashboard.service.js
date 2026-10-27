import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { calculateBalance } from "./wallet.service.js";

const D = (value) => new Prisma.Decimal(value);

// YYYY-MM-DD pada zona waktu pengguna.
// Jika pengaturan timezone tidak valid, gunakan Asia/Jakarta.
export function getLocalDate(timezone = "Asia/Jakarta") {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const value = (type) =>
            parts.find((part) => part.type === type)?.value;

        return `${value("year")}-${value("month")}-${value("day")}`;
    } catch {
        return getLocalDate("Asia/Jakarta");
    }
}

// Batas awal inklusif dan akhir eksklusif.
export function monthRange(month) {
    const [year, number] = month.split("-").map(Number);

    const start = new Date(Date.UTC(year, number - 1, 1));
    const end = new Date(Date.UTC(year, number, 1));

    return { gte: start, lt: end };
}

export async function getUserPeriod(userId, requestedMonth) {
    const settings = await prisma.userSettings.findUnique({
        where: { userId }
    });

    const timezone = settings?.timezone || "Asia/Jakarta";
    const currentDate = getLocalDate(timezone);

    return {
        timezone,
        month: requestedMonth || currentDate.slice(0, 7)
    };
}

export async function getDashboardSummary(userId, requestedMonth) {
    const { month, timezone } = await getUserPeriod(
        userId,
        requestedMonth
    );

    const dateRange = monthRange(month);

    const [wallets, incomeResult, expenseResult, count] =
        await Promise.all([
            // Termasuk archived wallet untuk perhitungan total saldo.
            prisma.wallet.findMany({
                where: { userId }
            }),
            prisma.transaction.aggregate({
                where: {
                    userId,
                    type: "INCOME",
                    transactionDate: dateRange
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    userId,
                    type: "EXPENSE",
                    transactionDate: dateRange
                },
                _sum: { amount: true }
            }),
            prisma.transaction.count({
                where: {
                    userId,
                    transactionDate: dateRange
                }
            })
        ]);

    // Menggunakan rumus saldo yang sama dengan Wallet API.
    const balances = await Promise.all(
        wallets.map(wallet => calculateBalance(prisma, wallet))
    );

    const totalBalance = balances.reduce(
        (sum, balance) => sum.plus(D(balance)),
        D(0)
    );

    const income = D(incomeResult._sum.amount ?? 0);
    const expense = D(expenseResult._sum.amount ?? 0);

    return {
        period: month,
        timezone,
        totalBalance: totalBalance.toFixed(2),
        totalIncome: income.toFixed(2),
        totalExpense: expense.toFixed(2),
        netCashFlow: income.minus(expense).toFixed(2),
        transactionCount: count,
        walletCount: wallets.filter(w => !w.isArchived).length
    };
}

export async function getRecentTransactions(userId, limit = 5) {
    const transactions = await prisma.transaction.findMany({
        where: { userId },
        take: limit,
        orderBy: [
            { transactionDate: "desc" },
            { createdAt: "desc" }
        ],
        include: {
            wallet: {
                select: { id: true, name: true }
            },
            category: {
                select: { id: true, name: true }
            }
        }
    });

    return transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toFixed(2),
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        inputMethod: transaction.inputMethod,
        wallet: transaction.wallet,
        category: transaction.category
    }));
}
