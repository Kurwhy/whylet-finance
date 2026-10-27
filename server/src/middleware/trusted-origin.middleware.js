const SAFE_METHODS = new Set([
    "GET",
    "HEAD",
    "OPTIONS"
]);

export function requireTrustedOrigin(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    const allowedOrigins = (
        process.env.CLIENT_URL || "http://localhost:5173"
    )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    let sourceOrigin = req.get("origin");

    if (!sourceOrigin) {
        const referer = req.get("referer");

        if (referer) {
            try {
                sourceOrigin = new URL(referer).origin;
            } catch {
                sourceOrigin = null;
            }
        }
    }

    if (!sourceOrigin || !allowedOrigins.includes(sourceOrigin)) {
        return res.status(403).json({
            success: false,
            message: "Origin request tidak diizinkan"
        });
    }

    next();
}
