import { randomBytes, createHash } from "node:crypto";
import { test, expect } from "./fixtures.js";

test("UI-14 Verifikasi email browser token sekali pakai dan kedaluwarsa", async ({ page, fixture: f }) => {
    // Hanya token sintetis fixture; tidak dicetak/di-attach. Pengiriman SMTP diuji FA-01 terpisah.
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await f.db.emailVerificationToken.create({ data: { userId: f.user.id, tokenHash, expiresAt: new Date(Date.now()+1800000) } });
    await page.goto(`/verify-email?token=${token}`);
    await page.getByRole("button", { name: "Verifikasi Email", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Email Berhasil Diverifikasi!", exact: true })).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:5174/verify-email");
    expect(Boolean((await f.db.user.findUnique({ where: { id: f.user.id } })).emailVerifiedAt)).toBe(true);
    await page.goto(`/verify-email?token=${token}`);
    await page.getByRole("button", { name: "Verifikasi Email", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("tidak valid atau kedaluwarsa");
    const expired = randomBytes(32).toString("hex");
    await f.db.emailVerificationToken.create({ data: { userId: f.user.id, tokenHash: createHash("sha256").update(expired).digest("hex"), expiresAt: new Date(Date.now()-60000) } });
    await page.goto(`/verify-email?token=${expired}`);
    await page.getByRole("button", { name: "Verifikasi Email", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("tidak valid atau kedaluwarsa");
});
