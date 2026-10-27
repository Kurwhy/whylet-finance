import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { validateTestUrl, verifyTestDatabase, GuardError } from "../tests/integration/guard.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
const modes = new Set(["check", "migrate", "test", "auth", "generate", "account"]);
let db;
let outcome;
const pending = reason => (mode === "account" ? ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06"] : mode === "auth" ? ["FA-01", "FA-02", "FA-03"] : Array.from({ length: 11 }, (_, i) => `DB-${String(i + 1).padStart(2, "0")}`)).map(id => ({ id, status: "NOT TESTED", reason }));
function child(command, args, env) {
    return new Promise(resolve => {
        const proc = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        const deadline = setTimeout(() => proc.kill("SIGTERM"), 180000);
        deadline.unref();
        // Jangan pernah meneruskan output Prisma/error mentah: bisa memuat secret.
        proc.stdout.on("data", bytes => { output = (output + bytes.toString()).slice(-200000); });
        proc.stderr.on("data", () => {});
        proc.on("error", () => { clearTimeout(deadline); resolve({ code: 1, output: "" }); });
        proc.on("close", code => { clearTimeout(deadline); resolve({ code, output }); });
    });
}
try {
    if (!modes.has(mode)) throw new GuardError("TEST_MODE_INVALID");
    if (mode === "migrate" && !process.argv.includes("--approved")) throw new GuardError("TEST_MIGRATION_APPROVAL_REQUIRED");
    const only = process.argv.find(arg => arg.startsWith("--only="))?.slice(7);
    if (only && !/^DB-(?:0[1-9]|1[01])$/.test(only)) throw new GuardError("TEST_SELECTION_INVALID");
    let raw = process.env.TEST_DATABASE_URL;
    if (!raw && existsSync(root + ".env.test")) raw = parse(readFileSync(root + ".env.test")).TEST_DATABASE_URL;
    const url = validateTestUrl(raw);
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await verifyTestDatabase(db, { migration: mode === "migrate" });
    console.log("PASS: guard URL, database aktif, role, dan hak akses testing.");
    // Child menerima environment minimal. DATABASE_URL selalu dipetakan dari URL yang lolos guard.
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        NODE_ENV: "test", TEST_DATABASE_URL: url, DATABASE_URL: url, ...(only ? { WHYLET_TEST_ONLY: only } : {}) };
    if (mode === "generate") {
        const generated = await child(process.execPath, ["node_modules/prisma/build/index.js", "generate", "--config", "prisma.test.config.ts"], env);
        if (generated.code !== 0) throw new GuardError("TEST_GENERATE_FAILED");
        console.log("PASS: Prisma Client dihasilkan tanpa koneksi development.");
    } else if (mode === "migrate") {
        const result = await child(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma.test.config.ts"], env);
        if (result.code !== 0) throw new GuardError("TEST_MIGRATION_FAILED");
        console.log("PASS: migrasi testing selesai.");
    } else if ((mode === "test" || mode === "auth" || mode === "account")) {
        const tables = await db.$queryRawUnsafe("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = 'whylet_test' AND table_name IN ('users', 'wallets', 'transactions', 'transfers', 'categories', 'auth_sessions', '_prisma_migrations')");
        if (Number(tables[0].total) !== 7) throw new GuardError("TEST_SCHEMA_NOT_READY");
        const failedMigrations = await db.$queryRawUnsafe("SELECT COUNT(*) AS total FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL");
        if (Number(failedMigrations[0].total)) throw new GuardError("TEST_SCHEMA_NOT_READY");
        const result = await child(process.execPath, [mode === "account" ? "tests/final/account-worker.js" : mode === "auth" ? "tests/final/auth-worker.js" : "tests/integration/worker.js"], env);
        const line = result.output.split("\n").findLast(value => value.startsWith("WHYLET_QA_RESULT="));
        if (!line) throw new GuardError("TEST_WORKER_FAILED");
        outcome = JSON.parse(line.slice("WHYLET_QA_RESULT=".length));
        // Hanya struktur laporan yang disusun worker, tidak ada URL/cookie/identitas akun.
        for (const item of outcome.results) console.log(`${item.id}: ${item.status} — ${item.reason || item.evidence}`);
        if (result.code !== 0 || outcome.results.some(r => r.status !== "PASS" && r.reason !== "NOT_SELECTED")) process.exitCode = 1;
    }
} catch (error) {
    const code = error instanceof GuardError ? error.code : "TEST_PREFLIGHT_FAILED";
    console.log(`DITOLAK: ${code}. Detail koneksi tidak ditampilkan.`);
    process.exitCode = 1;
    if (mode === "test" || mode === "auth" || mode === "account") outcome = { results: pending(code) };
} finally {
    if (db) await db.$disconnect().catch(() => {});
    if (outcome) {
        mkdirSync(root + "tests/integration/results", { recursive: true });
        writeFileSync(root + `tests/integration/results/${mode === "account" ? "account-latest" : mode === "auth" ? "auth-latest" : "latest"}.json`, JSON.stringify({ timestamp: new Date().toISOString(), ...outcome }, null, 2) + "\n", { mode: 0o600 });
    }
}
