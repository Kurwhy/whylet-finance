import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import {
    registerSchema,
    loginSchema
} from "../validators/auth.validator.js";
import {
    publicUser
} from "../utils/auth.js";
import {
    createPasswordAuthSession,
    revokeAuthSession,
    SESSION_COOKIE_NAME,
    sessionCookieOptions
} from "../services/auth-session.service.js";

export async function register(req, res, next) {
    try {
        const result = registerSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Data registrasi tidak valid",
                errors: result.error.flatten().fieldErrors
            });
        }

        const { name, email, password } = result.data;

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email sudah terdaftar"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    name,
                    email,
                    passwordHash
                }
            });

            await tx.userSettings.create({
                data: {
                    userId: newUser.id,
                    currency: "IDR",
                    timezone: "Asia/Jakarta",
                    theme: "system"
                }
            });

            return newUser;
        });

        // Membuat sesi login baru di server dan mengirim cookie sesi
        await createPasswordAuthSession(user.id, res, user.passwordHash);

        return res.status(201).json({
            success: true,
            message: "Registrasi berhasil",
            data: {
                user: publicUser(user)
            }
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            return res.status(409).json({
                success: false,
                message: "Email sudah terdaftar"
            });
        }

        next(error);
    }
}

export async function login(req, res, next) {
    try {
        const result = loginSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Email atau kata sandi tidak valid"
            });
        }

        const { email, password } = result.data;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !user.passwordHash) {
            return res.status(401).json({
                success: false,
                message: "Email atau kata sandi salah"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Email atau kata sandi salah"
            });
        }

        // Membuat sesi login baru di server dan mengirim cookie sesi
        await createPasswordAuthSession(user.id, res, user.passwordHash);

        return res.json({
            success: true,
            message: "Login berhasil",
            data: {
                user: publicUser(user)
            }
        });
    } catch (error) {
        if (error.status === 401) return res.status(401).json({ success: false, message: "Kredensial berubah. Silakan masuk kembali." });
        next(error);
    }
}

export async function me(req, res) {
    return res.json({
        success: true,
        data: {
            user: publicUser(req.user)
        }
    });
}

export async function logout(req, res, next) {
    try {
        // Mencabut sesi di server berdasarkan ID sesi dari req.authSession
        await revokeAuthSession(req.authSession.id);

        res.clearCookie(SESSION_COOKIE_NAME, {
            httpOnly: sessionCookieOptions.httpOnly,
            secure: sessionCookieOptions.secure,
            sameSite: sessionCookieOptions.sameSite,
            path: sessionCookieOptions.path
        });

        return res.json({
            success: true,
            message: "Logout berhasil"
        });
    } catch (error) {
        next(error);
    }
}