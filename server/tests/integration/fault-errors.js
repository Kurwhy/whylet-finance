import { Prisma } from "@prisma/client";

// MySQL/connector tertentu membungkus FK sebagai UnknownRequestError, tanpa P2003.
// SQLSTATE 23000 sendiri terlalu luas (juga dapat berarti unique violation).
// Hanya dipakai pada operasi fee dengan kategori yang sengaja tidak ada di DB-08.
export function isForeignKeyFailure(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2003";
    return error instanceof Prisma.PrismaClientUnknownRequestError &&
        /\b23000\b/.test(error.message) &&
        /foreign key constraint fails/i.test(error.message);
}
