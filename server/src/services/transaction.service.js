import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { calculateBalance } from "./wallet.service.js";

const Decimal = Prisma.Decimal;

export class TransactionError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const includeRelations = {
    wallet: {
        select: { id: true, name: true, type: true }
    },
    category: {
        select: { id: true, name: true, type: true }
    }
};

function formatTransaction(item) {
    return {
        ...item,
        amount: item.amount.toFixed(2)
    };
}

async function ownedTransaction(db, userId, id) {
    const transaction = await db.transaction.findFirst({
        where: { id, userId }
    });

    if (!transaction) {
        throw new TransactionError(
            "Transaksi tidak ditemukan",
            404
        );
    }

    return transaction;
}

async function validateRelations(db, userId, data) {
    const wallet = await db.wallet.findFirst({
        where: {
            id: data.walletId,
            userId,
            isArchived: false
        }
    });

    if (!wallet) {
        throw new TransactionError(
            "Dompet tidak ditemukan atau sudah diarsipkan",
            404
        );
    }

    const category = await db.category.findFirst({
        where: {
            id: data.categoryId,
            userId,
            type: data.type,
            isArchived: false
        }
    });

    if (!category) {
        throw new TransactionError(
            "Kategori tidak sesuai atau tidak ditemukan",
            400
        );
    }

    return wallet;
}

async function assertNonNegativeBalance(db, userId, walletId) {
    const wallet = await db.wallet.findFirst({
        where: { id: walletId, userId }
    });

    if (!wallet) {
        throw new TransactionError("Dompet tidak ditemukan", 404);
    }

    const balance = new Decimal(
        await calculateBalance(db, wallet)
    );

    if (balance.isNegative()) {
        throw new TransactionError(
            `Saldo ${wallet.name} tidak mencukupi`,
            400
        );
    }
}

async function runFinancialTransaction(callback) {
    // Retry terbatas untuk konflik transaksi database.
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

export async function getTransactions(userId, filters = {}) {
    const where = { userId };

    if (filters.type) where.type = filters.type;
    if (filters.walletId) where.walletId = filters.walletId;

    if (filters.startDate || filters.endDate) {
        where.transactionDate = {};

        if (filters.startDate) {
            where.transactionDate.gte =
                new Date(`${filters.startDate}T00:00:00.000Z`);
        }

        if (filters.endDate) {
            where.transactionDate.lte =
                new Date(`${filters.endDate}T00:00:00.000Z`);
        }
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [items, total] = await Promise.all([
        prisma.transaction.findMany({
            where,
            include: includeRelations,
            orderBy: [
                { transactionDate: "desc" },
                { createdAt: "desc" }
            ],
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.transaction.count({ where })
    ]);

    return {
        items: items.map(formatTransaction),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

export async function getTransaction(userId, id) {
    const item = await prisma.transaction.findFirst({
        where: { id, userId },
        include: includeRelations
    });

    if (!item) {
        throw new TransactionError(
            "Transaksi tidak ditemukan",
            404
        );
    }

    return formatTransaction(item);
}

export async function createTransaction(userId, data) {
    return runFinancialTransaction(async (tx) => {
        await validateRelations(tx, userId, data);

        const transaction = await tx.transaction.create({
            data: {
                userId,
                walletId: data.walletId,
                categoryId: data.categoryId,
                type: data.type,
                amount: data.amount,
                description: data.description,
                inputMethod: data.inputMethod,
                transactionDate: new Date(
                    `${data.transactionDate}T00:00:00.000Z`
                )
            },
            include: includeRelations
        });

        await assertNonNegativeBalance(
            tx,
            userId,
            data.walletId
        );

        return formatTransaction(transaction);
    });
}

export async function updateTransaction(userId, id, data) {
    return runFinancialTransaction(async (tx) => {
        const old = await ownedTransaction(tx, userId, id);

        if (old.transferId) {
            throw new TransactionError(
                "Biaya transfer tidak dapat diedit dari menu transaksi"
            );
        }

        const merged = {
            walletId: data.walletId ?? old.walletId,
            categoryId: data.categoryId ?? old.categoryId,
            type: data.type ?? old.type
        };

        // Validasi ulang kategori dan wallet.
        await validateRelations(tx, userId, merged);

        const changes = { ...data };

        if (data.transactionDate) {
            changes.transactionDate = new Date(
                `${data.transactionDate}T00:00:00.000Z`
            );
        }

        const updated = await tx.transaction.update({
            where: { id },
            data: changes,
            include: includeRelations
        });

        // Kedua wallet diperiksa jika transaksi dipindahkan.
        await assertNonNegativeBalance(tx, userId, old.walletId);

        if (old.walletId !== updated.walletId) {
            await assertNonNegativeBalance(
                tx,
                userId,
                updated.walletId
            );
        }

        return formatTransaction(updated);
    });
}

export async function deleteTransaction(userId, id) {
    return runFinancialTransaction(async (tx) => {
        const old = await ownedTransaction(tx, userId, id);

        if (old.transferId) {
            throw new TransactionError(
                "Biaya transfer tidak dapat dihapus secara terpisah"
            );
        }

        await tx.transaction.delete({
            where: { id }
        });

        await assertNonNegativeBalance(
            tx,
            userId,
            old.walletId
        );

        return {
            id,
            message: "Transaksi berhasil dihapus"
        };
    });
}
