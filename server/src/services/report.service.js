import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import {
    getUserPeriod,
    monthRange
} from "./dashboard.service.js";

const D = (value) => new Prisma.Decimal(value);

function fixed(value) {
    return D(value ?? 0).toFixed(2);
}

export async function getMonthlyReport(userId, requestedYear) {
    const { month: currentMonth } = await getUserPeriod(userId);

    const year = requestedYear || Number(currentMonth.slice(0, 4));

    const periods = Array.from({ length: 12 }, (_, index) =>
        `${year}-${String(index + 1).padStart(2, "0")}`
    );

    const results = await Promise.all(
        periods.map(async (period) => {
            const grouped = await prisma.transaction.groupBy({
                by: ["type"],
                where: {
                    userId,
                    transactionDate: monthRange(period)
                },
                _sum: { amount: true }
            });

            const income = grouped.find(x => x.type === "INCOME");
            const expense = grouped.find(x => x.type === "EXPENSE");

            return {
                month: period,
                income: fixed(income?._sum.amount),
                expense: fixed(expense?._sum.amount),
                net: D(income?._sum.amount ?? 0)
                    .minus(D(expense?._sum.amount ?? 0))
                    .toFixed(2)
            };
        })
    );

    return { year, months: results };
}

export async function getCategoryReport(userId, options) {
    const { month } = await getUserPeriod(
        userId,
        options.month
    );

    const type = options.type || "EXPENSE";

    const grouped = await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
            userId,
            type,
            transactionDate: monthRange(month)
        },
        _sum: { amount: true },
        _count: { _all: true }
    });

    const categoryIds = grouped.map(x => x.categoryId);

    const categories = await prisma.category.findMany({
        where: {
            userId,
            id: { in: categoryIds }
        },
        select: {
            id: true,
            name: true,
            icon: true
        }
    });

    const categoryMap = new Map(
        categories.map(category => [category.id, category])
    );

    const total = grouped.reduce(
        (sum, item) => sum.plus(D(item._sum.amount ?? 0)),
        D(0)
    );

    const items = grouped.map(item => {
        const amount = D(item._sum.amount ?? 0);
        const category = categoryMap.get(item.categoryId);

        return {
            categoryId: item.categoryId,
            categoryName: category?.name || "Kategori tidak ditemukan",
            icon: category?.icon || null,
            amount: amount.toFixed(2),
            count: item._count._all,
            percentage: total.isZero()
                ? 0
                : Number(
                    amount.div(total).times(100).toFixed(2)
                )
        };
    });

    items.sort((a, b) =>
        D(b.amount).comparedTo(D(a.amount))
    );

    return {
        period: month,
        type,
        total: total.toFixed(2),
        categories: items
    };
}

// Menetralkan formula spreadsheet sebelum CSV diekspor.
function csvCell(value) {
    let text = String(value ?? "");

    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replaceAll('"', '""')}"`;
}

export async function exportTransactions(userId, options) {
    const { month } = await getUserPeriod(
        userId,
        options.month
    );

    const where = {
        userId,
        transactionDate: monthRange(month)
    };

    if (options.type) {
        where.type = options.type;
    }

    // Batas pengaman untuk MVP.
    const maxRows = 10000;

    const transactions = await prisma.transaction.findMany({
        where,
        take: maxRows + 1,
        orderBy: [
            { transactionDate: "desc" },
            { createdAt: "desc" }
        ],
        include: {
            wallet: { select: { name: true } },
            category: { select: { name: true } }
        }
    });

    if (transactions.length > maxRows) {
        const error = new Error(
            "Terlalu banyak transaksi untuk satu file CSV"
        );
        error.status = 413;
        throw error;
    }

    const headers = [
        "Tanggal",
        "Jenis",
        "Deskripsi",
        "Kategori",
        "Dompet",
        "Nominal",
        "Metode Input"
    ];

    const rows = transactions.map(item => [
        item.transactionDate.toISOString().slice(0, 10),
        item.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
        item.description,
        item.category.name,
        item.wallet.name,
        item.amount.toFixed(2),
        ({ MANUAL: "Manual", TEXT: "Teks", VOICE: "Suara", RECEIPT: "Struk" })[item.inputMethod]
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");

    // BOM membantu Excel mengenali karakter UTF-8.
    return {
        filename: `whylet-transactions-${month}.csv`,
        content: "\uFEFF" + csv
    };
}
