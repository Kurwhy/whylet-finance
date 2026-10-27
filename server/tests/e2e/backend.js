import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createSmtpSink } from "../final/smtp-sink.js";
import { validateTestUrl, verifyTestDatabase } from "../integration/guard.js";
let db;
let appDb;
let server;
let sink;
console.error = () => {}; // Endpoint error tidak boleh membocorkan input/SQL pada log pengujian.
try {
    const url = validateTestUrl(process.env.TEST_DATABASE_URL);
    if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== url) throw new Error();
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await verifyTestDatabase(db);
    process.env.JWT_SECRET = randomBytes(48).toString("hex");
    process.env.CSRF_SECRET = randomBytes(48).toString("hex");
    process.env.CLIENT_URL = "http://127.0.0.1:5174";
    sink = await createSmtpSink();
    process.env.SMTP_HOST = "127.0.0.1"; process.env.SMTP_PORT = String(sink.port); process.env.MAIL_FROM = "qa@example.invalid";
    const { default: app } = await import("../../src/app.js");
    appDb = (await import("../../src/config/prisma.js")).default;
    await verifyTestDatabase(appDb);
    server = app.listen(5002, "127.0.0.1", () => process.send?.("READY"));
    server.on("error", () => { process.send?.("FAILED"); process.exit(1); });
} catch { process.send?.("FAILED"); process.exitCode = 1; await db?.$disconnect(); }
async function shutdown() {
    server?.close();
    await sink?.close(); await appDb?.$disconnect(); await db?.$disconnect(); process.exit();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
