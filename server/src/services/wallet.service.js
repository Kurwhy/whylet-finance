import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";

const D = (value) => new Prisma.Decimal(value);

export class WalletError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// Mengecek apakah wallet mempunyai aktivitas keuangan.
async function hasActivity(db, walletId) {
    const [transactions, outgoing, incoming] = await Promise.all([
        db.transaction.count({ where: { walletId } }),
        db.transfer.count({ where: { fromWalletId: walletId } }),
        db.transfer.count({ where: { toWalletId: walletId } })
    ]);

    return transactions + outgoing + incoming > 0;
}

// Menghitung saldo dengan Prisma Decimal.
export async function calculateBalance(db, wallet) {
    const [income, expense, outgoing, incoming] = await Promise.all([
        db.transaction.aggregate({
            where: { walletId: wallet.id, type: "INCOME" },
            _sum: { amount: true }
        }),
        db.transaction.aggregate({
            where: { walletId: wallet.id, type: "EXPENSE" },
            _sum: { amount: true }
        }),
        db.transfer.findMany({
            where: { fromWalletId: wallet.id },
            include: { feeTransaction: { select: { id: true } } }
        }),
        db.transfer.aggregate({
            where: { toWalletId: wallet.id },
            _sum: { amount: true }
        })
    ]);

    let balance = D(wallet.openingBalance)
        .plus(income._sum.amount ?? 0)
        .minus(expense._sum.amount ?? 0)
        .plus(incoming._sum.amount ?? 0);

    // Jika biaya transfer sudah dicatat sebagai Transaction,
    // biaya tersebut telah masuk dalam total expense.
    for (const transfer of outgoing) {
        balance = balance.minus(transfer.amount);

        if (!transfer.feeTransaction) {
            balance = balance.minus(transfer.fee);
        }
    }

    return balance.toFixed(2);
}

async function formatWallet(db, wallet) {
    return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        openingBalance: wallet.openingBalance.toFixed(2),
        balance: await calculateBalance(db, wallet),
        isDefault: wallet.isDefault,
        isArchived: wallet.isArchived,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
    };
}

async function findOwnedWallet(db, userId, walletId) {
    const wallet = await db.wallet.findFirst({
        where: {
            id: walletId,
            userId
        }
    });

    if (!wallet) {
        throw new WalletError("Dompet tidak ditemukan", 404);
    }

    return wallet;
}

export async function getWallets(userId) {
    const wallets = await prisma.wallet.findMany({
        where: { userId },
        orderBy: [
            { isArchived: "asc" },
            { isDefault: "desc" },
            { createdAt: "asc" }
        ]
    });

    return Promise.all(
        wallets.map((wallet) => formatWallet(prisma, wallet))
    );
}

export async function getWallet(userId, walletId) {
    const wallet = await findOwnedWallet(prisma, userId, walletId);
    return formatWallet(prisma, wallet);
}

export async function createWallet(userId, data) {
    return prisma.$transaction(async (tx) => {
        const activeWalletCount = await tx.wallet.count({
            where: { userId, isArchived: false }
        });

        const wallet = await tx.wallet.create({
            data: {
                userId,
                name: data.name,
                type: data.type,
                openingBalance: data.openingBalance,
                isDefault: activeWalletCount === 0
            }
        });

        return formatWallet(tx, wallet);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}

export async function updateWallet(userId, walletId, data) {
    return prisma.$transaction(async (tx) => {
        const wallet = await findOwnedWallet(tx, userId, walletId);

        if (wallet.isArchived) {
            throw new WalletError("Dompet yang diarsipkan tidak dapat diedit");
        }

        if (
            data.openingBalance !== undefined &&
            await hasActivity(tx, walletId)
        ) {
            throw new WalletError(
                "Saldo awal tidak dapat diubah setelah ada transaksi"
            );
        }

        const updated = await tx.wallet.update({
            where: { id: walletId },
            data
        });

        return formatWallet(tx, updated);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}

export async function setDefaultWallet(userId, walletId) {
    return prisma.$transaction(async (tx) => {
        const wallet = await findOwnedWallet(tx, userId, walletId);

        if (wallet.isArchived) {
            throw new WalletError(
                "Dompet yang diarsipkan tidak bisa menjadi utama"
            );
        }

        await tx.wallet.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false }
        });

        const updated = await tx.wallet.update({
            where: { id: walletId },
            data: { isDefault: true }
        });

        return formatWallet(tx, updated);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}

export async function archiveWallet(userId, walletId) {
    return prisma.$transaction(async (tx) => {
        const wallet = await findOwnedWallet(tx, userId, walletId);

        if (wallet.isArchived) {
            throw new WalletError("Dompet sudah diarsipkan");
        }

        if (wallet.isDefault) {
            throw new WalletError(
                "Ganti dompet utama sebelum mengarsipkan dompet ini"
            );
        }

        const updated = await tx.wallet.update({
            where: { id: walletId },
            data: { isArchived: true }
        });

        return formatWallet(tx, updated);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}

export async function unarchiveWallet(userId, walletId) {
    return prisma.$transaction(async (tx) => {
        const wallet = await findOwnedWallet(tx, userId, walletId);

        if (!wallet.isArchived) {
            throw new WalletError("Dompet ini sudah aktif");
        }

        const updated = await tx.wallet.update({
            where: { id: walletId },
            data: {
                isArchived: false
            }
        });

        return formatWallet(tx, updated);
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}
