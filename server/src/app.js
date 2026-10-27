
import express from "express";
import crypto from "node:crypto";
import prisma from "./config/prisma.js";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import dashboardRoutes from "./routes/dashboard.routes.js";
import reportRoutes from "./routes/report.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { requireCsrf } from "./middleware/csrf.middleware.js";
import smartInputRoutes from "./routes/smart-input.routes.js";
import spendingLimitRoutes from "./routes/spending-limit.routes.js";

import {
    requireTrustedOrigin
} from "./middleware/trusted-origin.middleware.js";

import accountRoutes from "./routes/account.routes.js";

const app = express();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use((req, res, next) => { req.id = crypto.randomUUID(); res.set("X-Request-ID", req.id); next(); });

const CLIENT_URL =
    process.env.CLIENT_URL || "http://localhost:5173";

app.use(helmet());

app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}));

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(requireTrustedOrigin);

// Perlindungan tambahan untuk request yang mengubah data.
// Browser frontend harus berasal dari origin yang diizinkan.
app.use((req, res, next) => {
    const unsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];

    if (!unsafeMethods.includes(req.method)) {
        return next();
    }

    const origin = req.get("Origin");

    if (origin && origin !== CLIENT_URL) {
        return res.status(403).json({
            success: false,
            message: "Origin tidak diizinkan"
        });
    }

    next();
});

app.get("/api/v1/health", (req, res) => {
    res.json({
        success: true,
        message: "API Whylet aktif."
    });
});

app.get("/api/v1/ready", async (req, res) => {
    try { await prisma.$queryRaw`SELECT 1`; res.json({ success: true }); }
    catch { res.status(503).json({ success: false, message: "Layanan belum siap." }); }
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/wallets", requireAuth,
    requireCsrf, walletRoutes);
app.use("/api/v1/categories", requireAuth,
    requireCsrf, categoryRoutes);
app.use("/api/v1/transactions", requireAuth,
    requireCsrf, transactionRoutes);
app.use("/api/v1/transfers", requireAuth,
    requireCsrf, transferRoutes);
app.use("/api/v1/dashboard", requireAuth,
    requireCsrf, dashboardRoutes);
app.use("/api/v1/reports", requireAuth,
    requireCsrf, reportRoutes);
app.use("/api/v1/smart-input", requireAuth,
    requireCsrf, smartInputRoutes);
app.use("/api/v1/spending-limit", requireAuth,
    requireCsrf, spendingLimitRoutes);

app.get("/api/v1/protected", requireAuth, (req, res) => {
    res.json({
        success: true,
        message: "Kamu berhasil mengakses protected route",
        data: {
            userId: req.user.id,
            name: req.user.name
        }
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint tidak ditemukan"
    });
});

app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    console.error({ event: "request_failed", requestId: req.id, code: /^P\d{4}$/.test(err.code || "") ? err.code : "INTERNAL", status });
    const messages = { 400: "Permintaan tidak valid.", 401: "Sesi tidak valid. Silakan masuk kembali.", 403: "Tindakan tidak diizinkan.", 404: "Data tidak ditemukan.", 413: "Ukuran permintaan terlalu besar.", 429: "Terlalu banyak percobaan. Silakan coba lagi nanti." };
    res.status(status).json({ success: false, message: status >= 500 ? "Terjadi kesalahan pada server" : messages[status] || "Permintaan tidak dapat diproses.", requestId: req.id });
});

export default app;
