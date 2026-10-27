import prisma from "../config/prisma.js";
import {
    COOKIE_NAME,
    verifyToken
} from "../utils/auth.js";
import {
    SESSION_COOKIE_NAME,
    getActiveSession
} from "../services/auth-session.service.js";

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.[SESSION_COOKIE_NAME];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Silakan login terlebih dahulu"
            });
        }

        const session = await getActiveSession(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Sesi tidak aktif atau sudah kedaluwarsa"
            });
        }

        req.user = session.user;
        req.authSession = session;

        next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Sesi tidak valid atau sudah kedaluwarsa"
            });
        }

        next(error);
    }
}
