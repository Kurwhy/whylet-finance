import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import { hashToken } from "./auth-session.service.js";
import { sendVerificationEmail } from "./email.service.js";

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

export async function issueVerificationEmail(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            email: true,
            emailVerifiedAt: true
        }
    });

    if (!user || user.emailVerifiedAt) return;

    const rawToken = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction(async (tx) => {
        await tx.emailVerificationToken.deleteMany({
            where: { userId }
        });

        await tx.emailVerificationToken.create({
            data: {
                userId,
                tokenHash: hashToken(rawToken),
                expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS)
            }
        });
    });

    await sendVerificationEmail(user.email, rawToken);
}

export async function verifyEmailToken(rawToken) {
    if (
        typeof rawToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(rawToken)
    ) {
        return false;
    }

    const tokenHash = hashToken(rawToken);

    const result = await prisma.$transaction(async (tx) => {
        const token = await tx.emailVerificationToken.findUnique({
            where: { tokenHash }
        });

        if (
            !token ||
            token.usedAt ||
            token.expiresAt <= new Date()
        ) {
            return false;
        }

        // Update bersyarat supaya dua request bersamaan
        // tidak bisa memakai token yang sama dua kali.
        const consumed = await tx.emailVerificationToken.updateMany({
            where: {
                id: token.id,
                usedAt: null,
                expiresAt: { gt: new Date() }
            },
            data: {
                usedAt: new Date()
            }
        });

        if (consumed.count !== 1) return false;

        await tx.user.update({
            where: { id: token.userId },
            data: {
                emailVerifiedAt: new Date()
            }
        });

        return true;
    });

    return result;
}
