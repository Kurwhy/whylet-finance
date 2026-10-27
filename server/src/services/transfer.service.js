import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { calculateBalance } from "./wallet.service.js";

const Decimal = Prisma.Decimal;

export class TransferError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const relations = {
    fromWallet: {
        select: { id: true, name: true, type: true }
    },
    toWallet: {
        select: { id: true, name: true, type: true }
    }
};

function formatTransfer(transfer) {
    return {
        ...transfer,
        amount: transfer.amount.toFixed(2),
        fee: transfer.fee.toFixed(2),
        totalDeduction: transfer.amount
            .plus(transfer.fee)
            .toFixed(2)
    };
}

async function findOwnedWallet(tx, userId, walletId) {
    const wallet = await tx.wallet.findFirst({
        where: {
            id: walletId,
            userId,
            isArchived: false
        }
    });

    if (!wallet) {
        throw new TransferError(
            "Dompet tidak ditemukan atau sudah diarsipkan",
            404
        );
    }

    return wallet;
}

async function ensureTransferFeeCategory(tx, userId) {
    const name = "Biaya Transfer";

    // Reuse kategori yang sudah ada, termasuk yang diarsipkan.
    return tx.category.upsert({
        where: {
            userId_name_type: {
                userId,
                name,
                type: "EXPENSE"
            }
        },
        update: {
            isArchived: false
        },
        create: {
            userId,
            name,
            type: "EXPENSE",
            icon: "receipt",
            isArchived: false
        }
    });
}

async function executeWithRetry(callback) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await prisma.$transaction(callback, {
                isolationLevel:
                    Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 5000,
                timeout: 10000
            });
        } catch (error) {
            if (error.code !== "P2034" || attempt === 2) {
                throw error;
            }
        }
    }
}

// Primary key database menyimpan identitas permintaan secara persisten.
async function replayTransfer(db, userId, data, requestId) {
    if (!requestId) return null;
    const previous = await db.transfer.findUnique({ where: { id: requestId }, include: relations });
    if (!previous) return null;
    if (previous.userId !== userId || previous.fromWalletId !== data.fromWalletId ||
        previous.toWalletId !== data.toWalletId ||
        !new Decimal(previous.amount).equals(data.amount) ||
        !new Decimal(previous.fee).equals(data.fee) ||
        previous.transferDate.toISOString().slice(0, 10) !== data.transferDate ||
        (previous.note ?? "") !== (data.note ?? "")) {
        throw new TransferError("Kunci permintaan sudah digunakan untuk transfer lain.", 409);
    }
    return formatTransfer(previous);
}

export async function createTransfer(userId, data, requestId) {
    try {
        return await executeWithRetry(async (tx) => {
            const previous = await replayTransfer(tx, userId, data, requestId);
            if (previous) return previous;
            const source = await findOwnedWallet(
                tx,
                userId,
                data.fromWalletId
            );

            await findOwnedWallet(
                tx,
                userId,
                data.toWalletId
            );

            const amount = new Decimal(data.amount);
            const fee = new Decimal(data.fee);

            const transferDate = new Date(
                `${data.transferDate}T00:00:00.000Z`
            );

            const currentBalance = new Decimal(
                await calculateBalance(tx, source)
            );

            const totalRequired = amount.plus(fee);

            if (currentBalance.lessThan(totalRequired)) {
                throw new TransferError(
                    "Saldo dompet asal tidak mencukupi"
                );
            }

            // Buat record transfer.
            const transfer = await tx.transfer.create({
                data: {
                    ...(requestId ? { id: requestId } : {}),
                    userId,
                    fromWalletId: source.id,
                    toWalletId: data.toWalletId,
                    amount,
                    fee,
                    transferDate,
                    note: data.note ?? null
                }
            });

            // Biaya administrasi dihitung sebagai pengeluaran.
            if (fee.greaterThan(0)) {
                const category = await ensureTransferFeeCategory(
                    tx,
                    userId
                );

                await tx.transaction.create({
                    data: {
                        userId,
                        walletId: source.id,
                        categoryId: category.id,
                        type: "EXPENSE",
                        amount: fee,
                        description: "Biaya transfer antar-dompet",
                        transactionDate: transferDate,
                        inputMethod: "MANUAL",
                        transferId: transfer.id
                    }
                });
            }

            // Validasi ulang di dalam database transaction.
            const finalBalance = new Decimal(
                await calculateBalance(tx, source)
            );

            if (finalBalance.isNegative()) {
                throw new TransferError(
                    "Saldo dompet asal tidak mencukupi"
                );
            }

            const result = await tx.transfer.findUnique({
                where: { id: transfer.id },
                include: relations
            });

            return formatTransfer(result);
        });
    } catch (error) {
        // Perlombaan request diselesaikan oleh constraint unik di database.
        if (requestId && (error.code === "P2002" || error.code === "P2034")) {
            const previous = await replayTransfer(prisma, userId, data, requestId);
            if (previous) return previous;
        }
        throw error;
    }
}

export async function getTransfers(userId) {
    const transfers = await prisma.transfer.findMany({
        where: { userId },
        include: relations,
        orderBy: [
            { transferDate: "desc" },
            { createdAt: "desc" }
        ]
    });

    return transfers.map(formatTransfer);
}

export async function getTransfer(userId, id) {
    const transfer = await prisma.transfer.findFirst({
        where: {
            id,
            userId
        },
        include: relations
    });

    if (!transfer) {
        throw new TransferError(
            "Transfer tidak ditemukan",
            404
        );
    }

    return formatTransfer(transfer);
}
