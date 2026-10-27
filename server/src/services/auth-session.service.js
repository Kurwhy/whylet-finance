import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_NAME = "whylet_session";

export const sessionCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS
};

export function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

export function safeTokenMatch(rawToken, storedHash) {
    if (
        typeof rawToken !== "string" ||
        typeof storedHash !== "string" ||
        !/^[a-f0-9]{64}$/i.test(storedHash)
    ) {
        return false;
    }

    const actual = Buffer.from(hashToken(rawToken), "hex");
    const expected = Buffer.from(storedHash, "hex");

    return crypto.timingSafeEqual(actual, expected);
}

export function createCsrfToken(sessionId, nonce) {
    const secret = process.env.CSRF_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error("CSRF_SECRET belum dikonfigurasi dengan benar");
    }

    const signature = crypto
        .createHmac("sha256", secret)
        .update(`${sessionId}:${nonce}`)
        .digest("hex");

    return `${nonce}.${signature}`;
}

export function verifyCsrfToken(session, token) {
    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}\.[a-f0-9]{64}$/i.test(token)
    ) {
        return false;
    }

    const expected = createCsrfToken(
        session.id,
        session.csrfNonce
    );

    const actualBuffer = Buffer.from(token, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        actualBuffer,
        expectedBuffer
    );
}

export async function createAuthSession(userId, res, db = prisma) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET belum dikonfigurasi");
    }

    const csrfNonce = crypto.randomBytes(32).toString("hex");

    const session = await db.authSession.create({
        data: {
            userId,
            csrfNonce,
            expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
        }
    });

    try {
        const token = jwt.sign(
            {
                sub: userId,
                sid: session.id
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: "24h",
                issuer: "whylet-api",
                audience: "whylet-web"
            }
        );

        res.cookie(
            SESSION_COOKIE_NAME,
            token,
            sessionCookieOptions
        );

        return {
            sessionId: session.id,
            csrfToken: createCsrfToken(session.id, csrfNonce)
        };
    } catch (error) {
        await db.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
        });

        throw error;
    }
}

// Kunci pengguna selama validasi hash ulang dan pembuatan sesi agar reset password
// tidak berlomba dengan login memakai hash yang baru saja diganti.
export async function createPasswordAuthSession(userId, res, expectedHash) {
    return prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw`SELECT password_hash AS hash FROM users WHERE id = ${userId} FOR UPDATE`;
        if (rows[0]?.hash !== expectedHash) {
            const error = new Error("Kredensial berubah. Silakan masuk kembali."); error.status = 401; throw error;
        }
        return createAuthSession(userId, res, tx);
    });
}

export async function getActiveSession(jwtToken) {
    const decoded = jwt.verify(
        jwtToken,
        process.env.JWT_SECRET,
        {
            algorithms: ["HS256"],
            issuer: "whylet-api",
            audience: "whylet-web"
        }
    );

    if (
        !decoded ||
        typeof decoded !== "object" ||
        typeof decoded.sub !== "string" ||
        typeof decoded.sid !== "string"
    ) {
        return null;
    }

    const session = await prisma.authSession.findFirst({
        where: {
            id: decoded.sid,
            userId: decoded.sub,
            revokedAt: null,
            expiresAt: { gt: new Date() }
        },
        include: { user: true }
    });

    return session;
}

export async function revokeAuthSession(sessionId) {
    await prisma.authSession.updateMany({
        where: {
            id: sessionId,
            revokedAt: null
        },
        data: { revokedAt: new Date() }
    });
}