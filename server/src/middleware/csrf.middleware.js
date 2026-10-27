import {
    verifyCsrfToken
} from "../services/auth-session.service.js";

const SAFE_METHODS = new Set([
    "GET",
    "HEAD",
    "OPTIONS"
]);

export function requireCsrf(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    if (!req.authSession) {
        return res.status(401).json({
            success: false,
            message: "Sesi tidak ditemukan"
        });
    }

    const token = req.get("X-CSRF-Token");

    if (!verifyCsrfToken(req.authSession, token)) {
        return res.status(403).json({
            success: false,
            message: "CSRF token tidak valid"
        });
    }

    next();
}
