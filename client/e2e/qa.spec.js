import { test, expect, login, api, apiURL, today, month, balance, shot, card, addTransaction } from "./fixtures.js";

test("UI-01 Authentication", async ({ page, fixture: f }) => {
    await page.goto("/wallets"); await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Email wajib diisi.", { exact: true })).toBeVisible();
    await expect(page.getByText("Kata sandi wajib diisi.", { exact: true })).toBeVisible();
    await login(page, f); await page.reload();
    await expect(page.getByRole("heading", { name: /Halo,/ })).toBeVisible();
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/wallets"); await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get(`${apiURL}/auth/me`)).status()).toBe(401);
});

test("UI-02 Dompet", async ({ page, fixture: f }) => {
    await login(page, f); await page.goto("/wallets");
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Tambah Dompet", exact: true }).click();
    const d = page.getByRole("dialog", { name: "Tambah Dompet", exact: true });
    const save = d.getByRole("button", { name: "Tambah Dompet", exact: true });
    await save.click(); await expect(d.getByText(/Nama dompet/).filter({ hasText: /wajib|minimal/ }).first()).toBeVisible();
    await d.getByLabel(/Nama Dompet/).fill("Ab"); await save.click();
    await expect(d.getByText("Nama dompet minimal 3 karakter.", { exact: true })).toBeVisible();
    await d.getByLabel(/Nama Dompet/).fill("Dompet Browser"); await d.getByLabel(/Saldo Awal/).fill("-1"); await save.click();
    await expect(d.getByText("Saldo awal harus berupa angka positif atau nol.", { exact: true })).toBeVisible();
    await d.getByLabel(/Saldo Awal/).fill("0");
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/wallets", async route => { if (route.request().method() === "POST") await gate; await route.continue(); });
    await save.click(); await expect(save).toBeDisabled(); release();
    await expect(d).not.toBeVisible();
    const created = await f.db.wallet.findFirst({ where: { userId: f.user.id, name: "Dompet Browser" } });
    expect(created.openingBalance.toFixed(2)).toBe("0.00");
    await card(page, "Dompet Browser").getByRole("button", { name: /Edit|Ubah/ }).click();
    const edit = page.getByRole("dialog", { name: "Ubah Dompet" });
    await edit.getByLabel(/Nama Dompet/).fill("Dompet Diubah"); await edit.getByRole("button", { name: "Simpan Perubahan" }).click(); await expect(edit).not.toBeVisible();
    await card(page, "Dompet Diubah").getByRole("button", { name: "Jadikan Utama" }).click();
    await expect(card(page, "Dompet Diubah").getByText("Utama", { exact: true })).toBeVisible();
    await card(page, "Asal E2E").getByRole("button", { name: "Jadikan Utama" }).click();
    await expect(card(page, "Asal E2E").getByText("Utama", { exact: true })).toBeVisible();
    await card(page, "Dompet Diubah").getByRole("button", { name: "Arsipkan" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ya, Arsipkan" }).click();
    await expect(page.getByRole("heading", { name: "Dompet Diarsipkan" })).toBeVisible();
    await page.getByRole("button", { name: "Pulihkan" }).click();
    await expect(page.getByRole("heading", { name: "Dompet Diubah", exact: true })).toBeVisible();
    expect((await f.db.wallet.findUnique({ where: { id: created.id } })).isArchived).toBe(false);
    await shot(page, "UI-02-dompet");
});

test("UI-03 Kegagalan API", async ({ page, fixture: f }) => {
    await login(page, f); await page.goto("/wallets");
    await page.getByRole("button", { name: "Tambah Dompet", exact: true }).click();
    const d = page.getByRole("dialog"); await d.getByLabel(/Nama Dompet/).fill("Input Tetap Ada");
    await page.route("**/wallets", route => route.request().method() === "POST" ? route.abort("failed") : route.continue());
    await d.getByRole("button", { name: "Tambah Dompet" }).click();
    await expect(d.getByText(/Tidak dapat terhubung ke server/)).toBeVisible();
    await expect(d.getByLabel(/Nama Dompet/)).toHaveValue("Input Tetap Ada");
    await expect(d.getByRole("button", { name: "Tambah Dompet" })).toBeEnabled();
    expect(await f.db.wallet.count({ where: { userId: f.user.id } })).toBe(2);
    await shot(page, "UI-03-gagal-api");
});

test("UI-04 Transaksi dan draft teks-suara", async ({ page, fixture: f }) => {
    await page.addInitScript(() => {
        window.SpeechRecognition = class {
            start() { this.onstart?.(); setTimeout(() => { const result = [{ transcript: "beli makan 25rb pakai Asal E2E" }]; result.isFinal = true; this.onresult?.({ results: [result] }); this.onend?.(); }, 20); }
            abort() { this.onend?.(); } stop() { this.onend?.(); }
        };
    });
    await login(page, f);
    await addTransaction(page, f, "INCOME", "500", "Gaji Browser");
    await addTransaction(page, f, "EXPENSE", "200", "Makan Browser"); await balance(page, f.source.id, "1300.00");
    await page.getByRole("button", { name: "Edit Makan Browser", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Ubah Transaksi" });
    await edit.getByLabel(/Nominal/).fill("250"); await edit.getByRole("button", { name: "Simpan Transaksi" }).click(); await expect(edit).not.toBeVisible(); await balance(page, f.source.id, "1250.00");
    await page.getByRole("button", { name: "Hapus Makan Browser", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ya, Hapus" }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible(); await balance(page, f.source.id, "1500.00");
    await page.getByRole("button", { name: "Tambah Transaksi", exact: true }).click();
    const d = page.getByRole("dialog", { name: "Tambah Transaksi" });
    await d.getByLabel(/Nominal/).fill("0"); await d.getByLabel(/Kategori/).selectOption(""); await d.getByLabel(/Tanggal/).fill("");
    await d.getByRole("button", { name: "Simpan Transaksi" }).click();
    await expect(d.getByText("Nominal harus lebih dari Rp0.", { exact: true })).toBeVisible();
    await expect(d.getByText("Pilih kategori yang valid.", { exact: true })).toBeVisible();
    await expect(d.getByText("Pilih tanggal transaksi yang valid.", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const before = await f.db.transaction.count({ where: { userId: f.user.id } });
    await page.getByRole("button", { name: "Input Cepat", exact: true }).click();
    await page.getByRole("dialog").locator("textarea").fill("beli makan 25rb pakai Asal E2E");
    await page.getByRole("button", { name: "Buat Draf" }).click();
    await expect(page.getByText("Draf berhasil dibuat", { exact: true })).toBeVisible();
    expect(await f.db.transaction.count({ where: { userId: f.user.id } })).toBe(before);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Input Cepat", exact: true }).click();
    await page.getByRole("button", { name: "Mulai pengenalan suara", exact: true }).click();
    await expect(page.getByRole("dialog").locator("textarea")).toHaveValue("beli makan 25rb pakai Asal E2E");
    await page.getByRole("button", { name: "Buat Draf" }).click(); await expect(page.getByText("Draf berhasil dibuat", { exact: true })).toBeVisible();
    expect(await f.db.transaction.count({ where: { userId: f.user.id } })).toBe(before);
    await page.keyboard.press("Escape");
});

test("UI-05 Transfer dan respons hilang sesudah commit", async ({ page, fixture: f }) => {
    await login(page, f); await page.goto("/wallets");
    await page.getByRole("button", { name: "Transfer Antar-Dompet", exact: true }).click();
    const d = page.getByRole("dialog", { name: "Transfer Antar-Dompet" });
    await d.getByLabel(/Nominal/).fill("200"); await d.getByLabel(/Biaya Admin/).fill("25");
    let posts = 0;
    await page.route("**/transfers", async route => {
        if (route.request().method() !== "POST") return route.continue();
        posts++;
        if (posts === 1) { const response = await route.fetch(); expect(response.status()).toBe(201); return route.abort("failed"); }
        return route.continue();
    });
    const save = d.getByRole("button", { name: "Konfirmasi Transfer" });
    await save.click({ clickCount: 2 });
    await expect(d.getByText(/Status transfer belum diketahui/)).toBeVisible();
    await expect(d.getByLabel(/Nominal/)).toBeDisabled();
    expect(await f.db.transfer.count({ where: { userId: f.user.id } })).toBe(1);
    await page.reload();
    const recovered = page.getByRole("dialog", { name: "Transfer Antar-Dompet" });
    await expect(recovered).toBeVisible();
    await recovered.getByRole("button", { name: "Periksa Ulang Transfer" }).click(); await expect(recovered).not.toBeVisible();
    expect(posts).toBe(2);
    expect(await f.db.transfer.count({ where: { userId: f.user.id } })).toBe(1);
    expect(await f.db.transaction.count({ where: { userId: f.user.id, type: "EXPENSE" } })).toBe(1);
    await balance(page, f.source.id, "775.00"); await balance(page, f.target.id, "200.00");
    await expect(card(page, "Asal E2E").getByRole("heading", { name: /775/ })).toBeVisible();
    await shot(page, "UI-05-transfer");
});

test("UI-06 Laporan grafik filter retry dan CSV", async ({ page, fixture: f }) => {
    await login(page, f);
    await addTransaction(page, f, "EXPENSE", "200", "CSV Pengeluaran Browser");
    await addTransaction(page, f, "INCOME", "100", "CSV Pemasukan Browser");
    await page.goto("/dashboard"); await expect(page.locator(".recharts-surface").first()).toBeVisible();
    await page.goto("/reports"); await expect(page.getByRole("heading", { name: /Ringkasan Tahun/ })).toBeVisible();
    await expect(page.getByText("Total: Rp 200", { exact: false })).toBeVisible();
    await page.getByLabel("Jenis", { exact: true }).selectOption("INCOME");
    await expect(page.getByText(/Total:.*100/)).toBeVisible();
    const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Unduh CSV Bulan Terpilih" }).click();
    const file = await download; const stream = await file.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString("utf8");
    expect(csv).toContain("CSV Pemasukan Browser"); expect(csv).not.toContain("CSV Pengeluaran Browser"); expect(file.suggestedFilename()).toContain(month);
    await page.getByLabel("Tahun", { exact: true }).fill("2001");
    await page.getByLabel("Bulan", { exact: true }).selectOption("01");
    await expect(page.getByLabel("Bulan", { exact: true }).locator("option:checked")).toHaveText("Januari");
    await expect(page.getByText("Belum Ada Data Laporan", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ringkasan Tahun 2001" })).toBeVisible();
    let fail = true;
    await page.route("**/reports/categories?**", route => fail ? route.abort("failed") : route.continue());
    await page.getByLabel("Tahun", { exact: true }).fill(month.slice(0, 4));
    await page.getByLabel("Bulan", { exact: true }).selectOption(month.slice(5));
    await expect(page.getByRole("button", { name: "Coba lagi", exact: true })).toBeVisible();
    fail = false; await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Pemasukan per Kategori/ })).toBeVisible();
    await shot(page, "UI-06-laporan");
});

test("UI-07 Batas pengeluaran 80 dan 100 persen", async ({ page, fixture: f }) => {
    await login(page, f);
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Batas Pengeluaran Bulanan" }) });
    for (const value of ["", "0", "-1"]) {
        await page.getByLabel("Batas pengeluaran per bulan (Rp)").fill(value);
        await page.getByRole("button", { name: "Simpan Batas", exact: true }).click();
        await expect(section.getByRole("alert")).toContainText("Masukkan batas pengeluaran");
    }
    await page.getByLabel("Batas pengeluaran per bulan (Rp)").fill("1000"); await page.getByRole("button", { name: "Simpan Batas", exact: true }).click();
    await expect(section.getByRole("button", { name: "Aktif", exact: true })).toBeVisible();
    await section.getByRole("button", { name: "Aktif", exact: true }).click(); await expect(section.getByRole("button", { name: "Nonaktif", exact: true })).toBeVisible();
    await section.getByRole("button", { name: "Nonaktif", exact: true }).click(); await expect(section.getByRole("button", { name: "Aktif", exact: true })).toBeVisible();
    await addTransaction(page, f, "EXPENSE", "800", "Batas Delapan Puluh"); await page.goto("/dashboard");
    await expect(section.getByText("Mendekati Batas", { exact: true })).toBeVisible();
    await addTransaction(page, f, "EXPENSE", "200", "Batas Seratus"); await page.goto("/dashboard");
    await expect(section.getByText("Melebihi Batas", { exact: true })).toBeVisible();
    expect((await f.db.spendingLimit.findUnique({ where: { userId: f.user.id } })).amount.toFixed(2)).toBe("1000.00");
    await page.route("**/spending-limit/toggle", route => route.abort("failed"));
    await section.getByRole("button", { name: "Aktif", exact: true }).click();
    await expect(section.getByRole("alert")).toContainText("Tidak dapat terhubung");
    await expect(section.getByRole("button", { name: "Aktif", exact: true })).toBeEnabled();
    await shot(page, "UI-07-batas");
});

for (const [name, width, height] of [["mobile",360,800],["tablet",768,1024],["desktop",1440,900]]) {
    test(`UI-08 Responsive ${name}`, async ({ page, fixture: f }) => {
        await page.setViewportSize({ width, height }); await login(page, f);
        if (width < 1024) {
            await expect(page.locator("aside")).toHaveAttribute("inert", "");
            await page.getByRole("button", { name: "Buka navigasi", exact: true }).click();
            await expect(page.getByRole("button", { name: "Tutup sidebar", exact: true })).toBeFocused();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("button", { name: "Buka navigasi", exact: true })).toBeFocused();
        }
        await addTransaction(page, f, "EXPENSE", "20", "Transaksi Responsif");
        for (const path of ["/wallets", "/transactions", "/reports", "/dashboard", "/account"]) {
            await page.goto(path); await expect(page.locator("main h1")).toBeVisible();
            if (path === "/reports") await expect(page.locator("main table")).toBeVisible();
            if (path === "/transactions") await expect(page.getByText("Transaksi Responsif", { exact: true }).filter({ visible: true })).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const navigation = width < 1024 ? page.getByRole("navigation", { name: "Navigasi ponsel" }) : page.locator("aside nav");
            await expect(navigation.getByRole("link", { name: "Dompet", exact: true })).toBeVisible();
            await navigation.getByRole("link", { name: "Dompet", exact: true }).click();
            await expect(page).toHaveURL(/\/wallets$/);
        }
        await page.goto("/wallets"); await page.getByRole("button", { name: "Tambah Dompet", exact: true }).click();
        const d = page.getByRole("dialog"); await expect(d).toBeVisible();
        const box = await d.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width+1);
        await page.keyboard.press("Escape"); await expect(d).not.toBeVisible();
        await shot(page, `UI-08-${name}`);
    });
}

test("UI-09 Accessibility fokus label keyboard Escape", async ({ page, fixture: f }) => {
    await login(page, f);
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
    await expect(page).toHaveTitle("Whylet");
    await page.goto("/wallets");
    const open = page.getByRole("button", { name: "Tambah Dompet", exact: true });
    await open.focus(); await page.keyboard.press("Enter");
    const d = page.getByRole("dialog"); await expect(d.getByLabel(/Nama Dompet/)).toBeFocused();
    for (let i=0;i<10;i++) {
        await page.keyboard.press("Tab");
        expect(await d.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape"); await expect(d).not.toBeVisible(); await expect(open).toBeFocused();
    const missing = [];
    const checkLabels = async (scope, area) => {
        const unlabeled = await scope.locator('input:not([type="hidden"]), select, textarea').evaluateAll(elements => elements.filter(el => !el.labels?.length && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).map(el => `${el.tagName}:${el.type}`));
        missing.push(...unlabeled.map(field => `${area}:${field}`));
    };
    await page.goto("/transactions");
    await checkLabels(page.locator("main"), "filter");
    await page.getByRole("button", { name: "Tambah Transaksi", exact: true }).click();
    const parent = page.getByRole("dialog", { name: "Tambah Transaksi", exact: true });
    await parent.getByRole("button", { name: "Tambah Kategori", exact: true }).click();
    const category = page.getByRole("dialog", { name: "Tambah Kategori", exact: true });
    await checkLabels(category, "kategori");
    await page.keyboard.press("Escape"); await expect(category).not.toBeVisible(); await expect(parent).toBeVisible();
    await expect(parent.getByRole("button", { name: "Tambah Kategori", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Input Cepat", exact: true }).click();
    await checkLabels(page.getByRole("dialog"), "teks");
    await page.getByRole("dialog").locator("textarea").fill("beli makan 25rb pakai Asal E2E");
    await page.getByRole("button", { name: "Buat Draf" }).click(); await expect(page.getByText("Draf berhasil dibuat", { exact: true })).toBeVisible();
    await checkLabels(page.getByRole("dialog"), "draf");
    await page.keyboard.press("Escape");
    expect(missing, "Semua kontrol formulir memiliki label aksesibel").toEqual([]);
});

test("UI-10 Isolasi dua akun", async ({ page, browser, fixture: f }) => {
    const b = await f.account();
    await f.db.wallet.update({ where: { id: b.source.id }, data: { name: "Hanya Akun Kedua" } });
    await f.db.transaction.create({ data: { userId: b.user.id, walletId: b.source.id, categoryId: b.expense.id, type: "EXPENSE", amount: "123", description: "Rahasia Sintetis B", transactionDate: new Date(`${today}T00:00:00Z`), inputMethod: "MANUAL" } });
    await login(page, f); await page.goto("/wallets"); await expect(page.getByText("Hanya Akun Kedua", { exact: true })).not.toBeVisible();
    expect((await api(page,"get",`/wallets/${b.source.id}`)).status()).toBe(404);
    const reportA=await api(page,"get",`/reports/categories?month=${month}&type=EXPENSE`); expect((await reportA.json()).data.total).toBe("0.00");
    await page.goto("/transactions"); await expect(page.getByText("Rahasia Sintetis B",{exact:true})).not.toBeVisible();
    const contextB=await browser.newContext({ baseURL:"http://127.0.0.1:5174" });
    try {
        const pageB=await contextB.newPage(); await login(pageB,b); await pageB.goto("/wallets");
        await expect(pageB.getByRole("heading",{name:"Hanya Akun Kedua",exact:true})).toBeVisible();
        const reportB=await api(pageB,"get",`/reports/categories?month=${month}&type=EXPENSE`); expect((await reportB.json()).data.total).toBe("123.00");
        expect((await api(pageB,"get",`/wallets/${f.source.id}`)).status()).toBe(404);
    } finally { await contextB.close(); }
});
