import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { validateTestUrl, verifyTestDatabase } from "../integration/guard.js";
import { createSmtpSink } from "./smtp-sink.js";
const results = [];
let db, appDb, sink, restoreGoogle;
console.error = () => {};
class SafeFailure extends Error {}
const check = (value, code) => { if (!value) throw new SafeFailure(code); };
const status = (res, code) => check(res.status === code, `HTTP_${res.status}_EXPECTED_${code}`);
const hash = token => createHash("sha256").update(token).digest("hex");
try {
    const url = validateTestUrl(process.env.TEST_DATABASE_URL);
    check(process.env.NODE_ENV === "test" && process.env.DATABASE_URL === url, "AUTH_TEST_ENV_REJECTED");
    db = new PrismaClient({ datasources: { db: { url } }, log: [] }); await verifyTestDatabase(db);
    sink = await createSmtpSink();
    process.env.JWT_SECRET = randomBytes(48).toString("hex"); process.env.CSRF_SECRET = randomBytes(48).toString("hex");
    process.env.CLIENT_URL = "http://127.0.0.1:5174"; process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(sink.port); process.env.MAIL_FROM = "qa@example.invalid";
    // Verifier Google hanya diganti dalam worker ini; bukan OAuth/token Google nyata.
    process.env.GOOGLE_CLIENT_ID = "synthetic-testing-audience";
    const { OAuth2Client } = await import("google-auth-library");
    const original = OAuth2Client.prototype.verifyIdToken;
    let audienceChecked = false;
    OAuth2Client.prototype.verifyIdToken = async options => {
        audienceChecked = options.audience === process.env.GOOGLE_CLIENT_ID;
        return { getPayload: () => ({ sub: randomUUID(), email: `${randomUUID()}@example.invalid`, name: "Google Sintetis", email_verified: true }) };
    };
    restoreGoogle = () => { OAuth2Client.prototype.verifyIdToken = original; };
    const { default: app } = await import("../../src/app.js");
    appDb = (await import("../../src/config/prisma.js")).default; await verifyTestDatabase(appDb);
    const { default: request } = await import("supertest"); const { default: bcrypt } = await import("bcryptjs");
    const password = randomBytes(32).toString("base64url"); const passwordHash = await bcrypt.hash(password, 4);
    const account = () => db.user.create({ data: { name: "Uji Verifikasi", email: `${randomUUID()}@example.invalid`, passwordHash } });
    const origin = process.env.CLIENT_URL;
    async function run(id, evidence, fn) {
        try { await fn(); results.push({ id, status: "PASS", evidence }); }
        catch (error) { results.push({ id, status: "FAIL", reason: error instanceof SafeFailure ? error.message : "AUTH_TEST_FAILURE_REDACTED" }); }
    }
    function post(path, data, cookie, csrf) {
        const call = request(app).post(`/api/v1${path}`).set("Origin", origin);
        if (cookie) call.set("Cookie", cookie); if (csrf) call.set("X-CSRF-Token", csrf);
        return call.send(data);
    }
    function cookieOf(response) {
        const header = response.headers["set-cookie"]?.find(v => v.startsWith("whylet_session="));
        check(header?.includes("HttpOnly") && /SameSite=Lax/i.test(header), "SESSION_COOKIE_FLAGS_MISSING");
        return header.split(";")[0];
    }
    await run("FA-01", "SMTP loopback menerima email; token hash, TTL 30 menit, verifikasi 200, replay 400.", async () => {
        const user = await account();
        const login = await post("/auth/login", { email: user.email, password }); status(login, 200);
        const cookie = cookieOf(login);
        const csrf = await request(app).get("/api/v1/auth/csrf-token").set("Cookie", cookie); status(csrf, 200);
        status(await post("/auth/resend-verification", {}, cookie, csrf.body.data.csrfToken), 200);
        check(sink.messages.length === 1, "SMTP_MESSAGE_MISSING");
        check(sink.messages[0].includes("Subject: Verifikasi email Whylet"), "SMTP_SUBJECT_NOT_INDONESIAN");
        const decoded = sink.messages[0].replace(/=\r?\n/g, "").replace(/=3D/gi, "=");
        const token = /\/verify-email\?token=([a-f0-9]{64})/.exec(decoded)?.[1]; check(Boolean(token), "SMTP_LINK_MISSING");
        const row = await db.emailVerificationToken.findUnique({ where: { tokenHash: hash(token) } });
        check(row?.userId === user.id && row.tokenHash !== token && !row.usedAt, "TOKEN_HASH_INVALID");
        const remaining = row.expiresAt - Date.now(); check(remaining > 29 * 60000 && remaining <= 30 * 60000, "TOKEN_TTL_INVALID");
        status(await post("/auth/verify-email", { token }), 200);
        check(Boolean((await db.user.findUnique({ where: { id: user.id } })).emailVerifiedAt), "USER_NOT_VERIFIED");
        check(Boolean((await db.emailVerificationToken.findUnique({ where: { id: row.id } })).usedAt), "TOKEN_NOT_CONSUMED");
        status(await post("/auth/verify-email", { token }), 400);
    });
    await run("FA-02", "Token kedaluwarsa ditolak; dua request token sama hanya satu berhasil di MySQL.", async () => {
        const user = await account(); const expired = randomBytes(32).toString("hex");
        const row = await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash(expired), expiresAt: new Date(Date.now() - 60000) } });
        status(await post("/auth/verify-email", { token: expired }), 400);
        check(!(await db.emailVerificationToken.findUnique({ where: { id: row.id } })).usedAt && !(await db.user.findUnique({ where: { id: user.id } })).emailVerifiedAt, "EXPIRED_TOKEN_MUTATED");
        const token = randomBytes(32).toString("hex");
        await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 1800000) } });
        const responses = await Promise.all([1, 2].map(() => post("/auth/verify-email", { token })));
        check(responses.filter(res => res.status === 200).length === 1 && responses.filter(res => res.status === 400).length === 1, "CONCURRENT_TOKEN_REUSE");
    });
    await run("FA-03", "Callback Google dengan verifier stub: AuthSession/MySQL, cookie, CSRF, logout dan revocation nyata lulus.", async () => {
        const response = await post("/auth/google", { credential: randomBytes(150).toString("hex") }); status(response, 200);
        check(audienceChecked, "GOOGLE_AUDIENCE_NOT_PASSED");
        const userId = response.body.data.user.id; const cookie = cookieOf(response);
        const row = await db.authSession.findFirst({ where: { userId, revokedAt: null } });
        check(row?.csrfNonce.length === 64 && row.expiresAt > new Date(), "GOOGLE_SESSION_MISSING");
        const identity = await db.authAccount.findFirst({ where: { userId, provider: "GOOGLE" } }); check(Boolean(identity), "GOOGLE_IDENTITY_MISSING");
        const csrf = await request(app).get("/api/v1/auth/csrf-token").set("Cookie", cookie); status(csrf, 200);
        const body = { name: "Dompet Google QA", type: "CASH", openingBalance: "0" };
        status(await post("/wallets", body, cookie, "invalid"), 403);
        status(await post("/wallets", body, cookie, csrf.body.data.csrfToken), 201);
        status(await post("/auth/logout", {}, cookie, csrf.body.data.csrfToken), 200);
        check(Boolean((await db.authSession.findUnique({ where: { id: row.id } })).revokedAt), "GOOGLE_SESSION_NOT_REVOKED");
        status(await request(app).get("/api/v1/auth/me").set("Cookie", cookie), 401);
        status(await post("/wallets", body, cookie, csrf.body.data.csrfToken), 401);
    });
} catch { /* Detail koneksi dan token tidak dicetak. */ }
finally {
    restoreGoogle?.(); if (sink) await sink.close(); await appDb?.$disconnect(); await db?.$disconnect();
    for (const id of ["FA-01", "FA-02", "FA-03"]) if (!results.some(r => r.id === id)) results.push({ id, status: "NOT TESTED", reason: "AUTH_TEST_PREFLIGHT_FAILED" });
    process.stdout.write(`WHYLET_QA_RESULT=${JSON.stringify({ results })}\n`);
    process.exitCode = results.every(r => r.status === "PASS") ? 0 : 1;
}
