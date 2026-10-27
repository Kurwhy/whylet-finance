import { test, expect, login, shot, addTransaction, balance } from "./fixtures.js";
for (const [size, width, height] of [["desktop",1440,900],["mobile",360,800]]) {
    test(`UI-13 Cross-browser smoke ${size}`, async ({ page, fixture: f }, info) => {
        await page.setViewportSize({ width, height }); await login(page, f); await page.reload();
        await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
        const navigation = width < 1024 ? page.getByRole("navigation", { name: "Navigasi ponsel" }) : page.locator("aside nav");
        await navigation.getByRole("link", { name: "Dompet", exact: true }).click();
        await page.getByRole("button", { name: "Tambah Dompet", exact: true }).click();
        const d = page.getByRole("dialog", { name: "Tambah Dompet" });
        await d.getByRole("button", { name: "Tambah Dompet" }).click();
        await expect(d.getByText(/Nama dompet (wajib|minimal)/).first()).toBeVisible();
        await d.getByLabel(/Nama Dompet/).fill("Dompet Lintas Browser");
        await d.getByLabel(/Saldo Awal/).fill("0");
        await d.getByRole("button", { name: "Tambah Dompet" }).click(); await expect(d).not.toBeVisible();
        await expect(page.getByRole("heading", { name: "Dompet Lintas Browser", exact: true })).toBeVisible();
        await addTransaction(page, f, "EXPENSE", "20", "Smoke Transaksi"); await balance(page,f.source.id,"980.00");
        await page.getByRole("button", { name: "Tambah Transaksi", exact: true }).click();
        await expect(page.getByRole("dialog").getByLabel(/Nominal/)).toBeVisible();
        await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.goto("/account"); await expect(page.getByRole("heading", { name: "Profil Saya", exact: true })).toBeVisible();
        await expect(page.getByLabel("Nama Lengkap", { exact: false })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await shot(page, `smoke-${info.project.name}-${size}`);
    });
}
