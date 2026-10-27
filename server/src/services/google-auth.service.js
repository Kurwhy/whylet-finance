import { OAuth2Client } from "google-auth-library";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";

const googleClient = new OAuth2Client();

export class GoogleAuthError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function authenticateWithGoogle(idToken) {
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error("GOOGLE_CLIENT_ID belum dikonfigurasi");
    }

    let payload;

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        payload = ticket.getPayload();
    } catch {
        throw new GoogleAuthError(
            "Token Google tidak valid atau sudah kedaluwarsa",
            401
        );
    }

    if (
        !payload?.sub ||
        !payload?.email ||
        payload.email_verified !== true
    ) {
        throw new GoogleAuthError(
            "Identitas atau email Google belum terverifikasi",
            401
        );
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const name = (
        payload.name ||
        email.split("@")[0]
    ).trim().slice(0, 100);

    if (!name || email.length > 191) {
        throw new GoogleAuthError(
            "Profil Google tidak memenuhi persyaratan Whylet"
        );
    }

    const linked = await prisma.authAccount.findUnique({
        where: {
            provider_providerAccountId: {
                provider: "GOOGLE",
                providerAccountId: googleId
            }
        },
        include: { user: true }
    });

    // Akun Google yang sudah terhubung.
    if (linked) {
        return linked.user;
    }

    // Jangan otomatis menggabungkan akun berdasarkan email.
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        throw new GoogleAuthError(
            "Email sudah terdaftar. Masuk dengan metode sebelumnya. Penghubungan akun Google akan tersedia melalui pengaturan akun.",
            409
        );
    }

    try {
        return await prisma.$transaction(
            async (tx) => {
                const user = await tx.user.create({
                    data: {
                        name,
                        email,
                        passwordHash: null,
                        emailVerifiedAt: new Date()
                    }
                });

                await tx.authAccount.create({
                    data: {
                        userId: user.id,
                        provider: "GOOGLE",
                        providerAccountId: googleId
                    }
                });

                await tx.userSettings.create({
                    data: {
                        userId: user.id,
                        currency: "IDR",
                        timezone: "Asia/Jakarta",
                        theme: "system"
                    }
                });

                return user;
            },
            {
                isolationLevel:
                    Prisma.TransactionIsolationLevel.Serializable
            }
        );
    } catch (error) {
        // Dua request bersamaan bisa mencoba membuat akun yang sama.
        if (error.code === "P2002" || error.code === "P2034") {
            throw new GoogleAuthError(
                "Akun sedang diproses. Silakan coba masuk kembali.",
                409
            );
        }

        throw error;
    }
}
