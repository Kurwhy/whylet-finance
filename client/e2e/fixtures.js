import { test as base, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { validateTestUrl, verifyTestDatabase } from "../../server/tests/integration/guard.js";
const requireServer = createRequire(new URL("../../server/package.json", import.meta.url));
const { PrismaClient } = requireServer("@prisma/client");
const bcrypt = requireServer("bcryptjs");
export { expect };
export const apiURL = "http://127.0.0.1:5002/api/v1";
export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const month = today.slice(0, 7);
export const test = base.extend({
    fixture: async ({ page, context, browser }, provideFixture, testInfo) => {
        const url = validateTestUrl(process.env.TEST_DATABASE_URL);
        if (process.env.DATABASE_URL !== url || process.env.NODE_ENV !== "test") throw new Error("E2E_ENV_REJECTED");
        const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
        await verifyTestDatabase(db);
        const password = randomBytes(28).toString("base64url");
        const hash = await bcrypt.hash(password, 4);
        async function account() {
            const user = await db.user.create({ data: { name: "Pengguna Uji", email: `${randomUUID()}@example.invalid`, passwordHash: hash } });
            await db.userSettings.create({ data: { userId: user.id, timezone: "Asia/Jakarta" } });
            const source = await db.wallet.create({ data: { userId: user.id, name: "Asal E2E", type: "CASH", openingBalance: "1000", isDefault: true } });
            const target = await db.wallet.create({ data: { userId: user.id, name: "Tujuan E2E", type: "BANK", openingBalance: "0" } });
            const income = await db.category.create({ data: { userId: user.id, name: "Gaji", type: "INCOME" } });
            const expense = await db.category.create({ data: { userId: user.id, name: "Makanan", type: "EXPENSE" } });
            return { user, source, target, income, expense, password };
        }
        const user = await account();
        mkdirSync("e2e-results", { recursive: true });
        writeFileSync(`e2e-results/browser-${testInfo.project.name}.json`, JSON.stringify({ browser: testInfo.project.name, version: browser.version(), headless: true, locale: "id-ID", timezone: "Asia/Jakarta" }, null, 2));
        const errors = [];
        page.on("pageerror", () => errors.push("JS_EXCEPTION"));
        page.on("console", message => {
            if (message.type() === "error" && !/Failed to load resource|net::ERR_|favicon/i.test(message.text())) {
                const text = message.text();
                errors.push("CONSOLE_ERROR");
                writeFileSync("e2e-results/console-kind.json", JSON.stringify({
                    vite: /vite|hot-update|hmr/i.test(text), websocket: /WebSocket/i.test(text), react: /React|render|state|component/i.test(text), cors: /CORS|cross-origin|XMLHttpRequest/i.test(text), resource: /resource|network|ERR_/i.test(text), warning: /warn/i.test(text), count: errors.length
                }, null, 2));
            }
        });
        await context.route("**/*", route => {
            const hostname = new URL(route.request().url()).hostname;
            return ["127.0.0.1", "localhost"].includes(hostname) ? route.continue() : route.abort();
        });
        try {
            await provideFixture({ ...user, db, account, errors });
            expect(errors, "Tidak ada exception JavaScript/console penting").toEqual([]);
        } finally {
            if (testInfo.status !== "passed" || errors.length) await shot(page, "failure-" + testInfo.title.replace(/[^A-Za-z0-9-]/g, "-")).catch(() => {});
            await db.$disconnect();
        }
    }
});
export async function login(page, f) {
    await page.goto("/login");
    await page.getByLabel(/Alamat Email/).fill(f.user.email);
    await page.getByLabel(/Kata Sandi/, { exact: false }).fill(f.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
}
export async function api(page, method, path, data) {
    let headers = { Origin: "http://127.0.0.1:5174" };
    if (!["get", "head"].includes(method)) {
        const response = await page.request.get(`${apiURL}/auth/csrf-token`);
        expect(response.status()).toBe(200);
        headers["X-CSRF-Token"] = (await response.json()).data.csrfToken;
    }
    return page.request[method](`${apiURL}${path}`, { headers, ...(data ? { data } : {}) });
}
export async function balance(page, id, expected) {
    const res = await api(page, "get", `/wallets/${id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).data.balance).toBe(expected);
}
export async function shot(page, name) {
    mkdirSync("e2e-results/screenshots", { recursive: true });
    await page.screenshot({ path: `e2e-results/screenshots/${name}.png`, fullPage: true,
        mask: [page.locator("aside .border-t, [data-private]"), page.locator('input[type="email"], input[type="password"]')] });
}
export const card = (page, name) => page.getByRole("heading", { name, exact: true }).locator("..");
export async function addTransaction(page, f, type, amount, description) {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Tambah Transaksi", exact: true }).click();
    const d = page.getByRole("dialog", { name: "Tambah Transaksi", exact: true });
    await d.getByLabel(/Jenis Transaksi/).selectOption(type);
    await d.getByLabel(/Nominal/).fill(amount);
    await d.getByLabel(/Keterangan/).fill(description);
    await d.getByLabel(/Kategori/).selectOption(type === "INCOME" ? f.income.id : f.expense.id);
    await d.getByRole("button", { name: "Simpan Transaksi" }).click();
    await expect(d).not.toBeVisible();
    await expect(page.getByText(description, { exact: true }).filter({ visible: true })).toBeVisible();
}
