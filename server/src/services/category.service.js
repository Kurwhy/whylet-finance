import prisma from "../config/prisma.js";

export class CategoryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function getCategories(userId) {
    return prisma.category.findMany({
        where: {
            userId,
            isArchived: false
        },
        orderBy: [
            { type: "asc" },
            { name: "asc" }
        ]
    });
}

export async function createCategory(userId, data) {
    const existing = await prisma.category.findFirst({
        where: {
            userId,
            name: data.name,
            type: data.type
        }
    });

    if (existing) {
        throw new CategoryError(
            "Kategori dengan nama tersebut sudah ada",
            409
        );
    }

    return prisma.category.create({
        data: {
            userId,
            ...data
        }
    });
}

export async function updateCategory(userId, id, data) {
    const category = await prisma.category.findFirst({
        where: { id, userId, isArchived: false }
    });

    if (!category) {
        throw new CategoryError("Kategori tidak ditemukan", 404);
    }

    return prisma.category.update({
        where: { id },
        data
    });
}

export async function archiveCategory(userId, id) {
    const category = await prisma.category.findFirst({
        where: { id, userId, isArchived: false }
    });

    if (!category) {
        throw new CategoryError("Kategori tidak ditemukan", 404);
    }

    return prisma.category.update({
        where: { id },
        data: { isArchived: true }
    });
}
