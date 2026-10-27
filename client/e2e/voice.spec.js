import { test, expect, login } from "./fixtures.js";

test("UI-11 Voice izin ditolak — event sintetis", async ({ page, fixture: f }) => {
    await page.addInitScript(() => {
        window.SpeechRecognition = class {
            start() { this.onerror?.({ error: "not-allowed" }); this.onend?.(); }
            abort() {} stop() {}
        };
    });
    await login(page, f); await page.goto("/transactions");
    await page.getByRole("button", { name: "Input Cepat", exact: true }).click();
    await page.getByRole("button", { name: "Mulai pengenalan suara", exact: true }).click();
    await expect(page.getByText("Izin mikrofon ditolak. Izinkan akses mikrofon melalui pengaturan browser.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").locator("textarea")).toBeEditable();
    expect(await f.db.transaction.count({ where: { userId: f.user.id } })).toBe(0);
});

test("UI-12 SpeechRecognition tidak tersedia — kemampuan dinonaktifkan di browser tes", async ({ page, fixture: f }) => {
    await page.addInitScript(() => { Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); });
    await login(page, f); await page.goto("/transactions");
    await page.getByRole("button", { name: "Input Cepat", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mulai pengenalan suara", exact: true })).toBeDisabled();
    await expect(page.getByText(/Browser ini belum mendukung pengenalan suara/)).toBeVisible();
    await expect(page.getByRole("dialog").locator("textarea")).toBeEditable();
    expect(await f.db.transaction.count({ where: { userId: f.user.id } })).toBe(0);
});
