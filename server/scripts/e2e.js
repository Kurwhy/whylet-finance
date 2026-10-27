import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { validateTestUrl, verifyTestDatabase } from "../tests/integration/guard.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const client = fileURLToPath(new URL("../../client/", import.meta.url));
const children = [];
let db;
async function portFree(port) {
    await new Promise((resolve, reject) => {
        const socket = createServer(); socket.once("error", reject);
        socket.listen(port, "127.0.0.1", () => socket.close(resolve));
    });
}
const argumentsForTests = process.argv.slice(2);
const explicitProject = argumentsForTests.some(value => value.startsWith("--project"));
if (!argumentsForTests.includes("--manual") && !explicitProject && !argumentsForTests.includes("--grep")) {
    const combined = [];
    let success = true;
    for (const project of ["chrome", "chrome-account", "firefox", "webkit"]) {
        const code = await new Promise(resolve => {
            const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--project=${project}`, ...argumentsForTests], { cwd: root, env: process.env, stdio: "inherit" });
            child.once("error", () => resolve(1)); child.once("exit", resolve);
        });
        if (code !== 0) success = false;
        try { combined.push(...JSON.parse(readFileSync(client + "e2e-results/latest.json")).results); } catch { success = false; }
    }
    writeFileSync(client + "e2e-results/latest.json", JSON.stringify({ timestamp: new Date().toISOString(), status: success ? "passed" : "failed", results: combined }, null, 2) + "\n", { mode: 0o600 });
    process.exitCode = success ? 0 : 1;
} else {
try {
    const raw = process.env.TEST_DATABASE_URL || (existsSync(root + ".env.test") ? parse(readFileSync(root + ".env.test")).TEST_DATABASE_URL : undefined);
    const url = validateTestUrl(raw);
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await verifyTestDatabase(db);
    console.log("PASS: E2E guard whylet_test dan grant terbatas.");
    await portFree(5002); await portFree(5174);
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "test", TEST_DATABASE_URL: url, DATABASE_URL: url, PLAYWRIGHT_BROWSERS_PATH: "/private/tmp/whylet-playwright-browsers" };
    const backend = spawn(process.execPath, ["tests/e2e/backend.js"], { cwd: root, env, stdio: ["ignore", "ignore", "ignore", "ipc"] }); children.push(backend);
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error()), 20000);
        backend.once("message", value => { clearTimeout(timeout); value === "READY" ? resolve() : reject(new Error()); });
        backend.once("error", reject); backend.once("exit", () => { clearTimeout(timeout); reject(new Error()); });
    });
    const frontend = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "vite.e2e.config.js"], { cwd: client, env, stdio: "ignore" }); children.push(frontend);
    let ready = false;
    for (let i = 0; i < 60; i++) {
        try { if ((await fetch("http://127.0.0.1:5174/")).ok) { ready = true; break; } } catch { /* Tunggu Vite. */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error();
    console.log("PASS: backend 5002 dan frontend 5174 testing siap.");
    if (process.argv.includes("--manual")) {
        console.log("MODE MANUAL: buka http://127.0.0.1:5174 di Chrome lokal. Daftarkan akun sintetis; tidak ada SpeechRecognition stub. Ctrl+C untuk berhenti.");
        await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
    } else {
        const args = ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
        const tests = spawn(process.execPath, args, { cwd: client, env, stdio: ["ignore", "pipe", "ignore"] }); children.push(tests);
        // Reporter buatan sendiri hanya menulis ID kasus/status/lokasi assertion, tanpa nilai input.
        tests.stdout.on("data", chunk => {
            for (const line of chunk.toString().split("\n")) if (/^UI-\d\d.*: (PASS|FAIL|NOT TESTED)/.test(line) || line.startsWith("E2E_RUNNER_ERROR")) console.log(line);
        });
        const exit = await new Promise(resolve => { tests.once("exit", resolve); tests.once("error", () => resolve(1)); });
        process.exitCode = exit === 0 ? 0 : 1;
    }
} catch { console.log("DITOLAK/GAGAL: E2E preflight atau layanan testing. Detail koneksi disembunyikan."); process.exitCode = 1; }
finally {
    for (const child of children.reverse()) {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGTERM");
            await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }
    }
    await db?.$disconnect();
}

}
