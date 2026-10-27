// Worker terisolasi: tidak dipanggil oleh server production atau test discovery unit.
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { validateTestUrl, verifyTestDatabase } from "./guard.js";
import { isForeignKeyFailure } from "./fault-errors.js";

const results = [];
let db;
let appDb;
const output = value => process.stdout.write(`WHYLET_QA_RESULT=${JSON.stringify(value)}\n`);
class CheckFailure extends Error {}
function check(condition, message) { if (!condition) throw new CheckFailure(message); }
function status(response, expected) { check(response.status === expected, `HTTP_${response.status}_EXPECTED_${expected}`); }
const money = value => new Prisma.Decimal(value).toFixed(2);
const runId = randomUUID();
// Tidak mencetak exception Express/Prisma: dapat berisi cookie, input, atau koneksi.
const originalError = console.error;
console.error = () => {};
try {
    const url = validateTestUrl(process.env.TEST_DATABASE_URL);
    check(process.env.NODE_ENV === "test" && process.env.DATABASE_URL === url, "WORKER_ENV_REJECTED");
    db = new PrismaClient({ datasources: { db: { url } }, log: [] });
    await verifyTestDatabase(db);
    process.env.JWT_SECRET = randomBytes(48).toString("hex");
    process.env.CSRF_SECRET = randomBytes(48).toString("hex");
    process.env.CLIENT_URL = "http://localhost:5174";
    const [{ default: app }, { default: request }, { default: bcrypt }, { default: singleton }] = await Promise.all([
        import("../../src/app.js"), import("supertest"), import("bcryptjs"), import("../../src/config/prisma.js")
    ]);
    appDb = singleton;
    // Verifikasi juga instance yang benar-benar dipakai controller/service.
    await verifyTestDatabase(appDb);
    const password = randomBytes(30).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 4); // Akun sintetis; verifier login tetap asli.
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const date = ["year", "month", "day"].map(type => parts.find(p => p.type === type).value).join("-");
    const origin = process.env.CLIENT_URL;

    async function login(user) {
        const response = await request(app).post("/api/v1/auth/login").set("Origin", origin).send({ email: user.email, password });
        status(response, 200);
        const sessionHeader = response.headers["set-cookie"]?.find(v => v.startsWith("whylet_session="));
        check(Boolean(sessionHeader?.includes("HttpOnly")) && /SameSite=Lax/i.test(sessionHeader), "COOKIE_FLAGS_INVALID");
        const cookie = sessionHeader?.split(";")[0];
        check(Boolean(cookie), "COOKIE_MISSING");
        const csrf = await request(app).get("/api/v1/auth/csrf-token").set("Cookie", cookie);
        status(csrf, 200);
        check(typeof csrf.body.data?.csrfToken === "string", "CSRF_MISSING");
        return { cookie, csrf: csrf.body.data.csrfToken, userId: user.id };
    }
    function api(auth, method, path, body, options = {}) {
        let call = request(app)[method](`/api/v1${path}`).set("Origin", origin).set("Cookie", auth.cookie);
        const token = Object.hasOwn(options, "csrf") ? options.csrf : auth.csrf;
        if (token !== null) call = call.set("X-CSRF-Token", token);
        if (options.key) call = call.set("Idempotency-Key", options.key);
        if (body !== undefined) call = call.send(body);
        return call;
    }
    async function fixture(label) {
        const a = await db.user.create({ data: { name: `QA ${label} A`, email: `${runId}-${label}-a@example.invalid`, passwordHash } });
        const b = await db.user.create({ data: { name: `QA ${label} B`, email: `${runId}-${label}-b@example.invalid`, passwordHash } });
        for (const user of [a, b]) await db.userSettings.create({ data: { userId: user.id, timezone: "Asia/Jakarta", currency: "IDR" } });
        const auth = await login(a);
        const makeWallet = async (name, openingBalance) => {
            const res = await api(auth, "post", "/wallets", { name, type: "CASH", openingBalance });
            status(res, 201);
            return res.body.data;
        };
        const source = await makeWallet("Asal Testing", "1000");
        const target = await makeWallet("Tujuan Testing", "0");
        const foreign = await db.wallet.create({ data: { userId: b.id, name: "Dompet Testing B", type: "CASH", openingBalance: "1000", isDefault: true } });
        const income = await db.category.create({ data: { userId: a.id, name: "Pemasukan Testing", type: "INCOME" } });
        const expense = await db.category.create({ data: { userId: a.id, name: "Pengeluaran Testing", type: "EXPENSE" } });
        const otherExpense = await db.category.create({ data: { userId: b.id, name: "Kategori Testing B", type: "EXPENSE" } });
        return { a, b, auth, source, target, foreign, income, expense, otherExpense };
    }
    function transaction(f, type, amount, walletId = f.source.id) {
        return { walletId, categoryId: type === "INCOME" ? f.income.id : f.expense.id, type, amount, description: "Transaksi sintetis QA", transactionDate: date, inputMethod: "MANUAL" };
    }
    function transfer(f, amount = "200", fee = "25") {
        return { fromWalletId: f.source.id, toWalletId: f.target.id, amount, fee, transferDate: date, note: "Transfer sintetis QA" };
    }
    async function assertBalance(auth, walletId, expected) {
        const response = await api(auth, "get", `/wallets/${walletId}`);
        status(response, 200);
        check(response.body.data.balance === expected, "API_BALANCE_MISMATCH");
        // Rekonstruksi saldo langsung dengan SQL/Decimal, tanpa calculateBalance aplikasi.
        const rows = await db.$queryRaw`
            SELECT w.opening_balance
                + COALESCE((SELECT SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END)
                    FROM transactions t WHERE t.wallet_id = w.id), 0)
                + COALESCE((SELECT SUM(tr.amount) FROM transfers tr WHERE tr.to_wallet_id = w.id), 0)
                - COALESCE((SELECT SUM(tr.amount + CASE WHEN EXISTS
                    (SELECT 1 FROM transactions ft WHERE ft.transfer_id = tr.id)
                    THEN 0 ELSE tr.fee END) FROM transfers tr WHERE tr.from_wallet_id = w.id), 0) AS balance
            FROM wallets w WHERE w.id = ${walletId}`;
        check(rows.length === 1 && money(rows[0].balance) === expected, "MYSQL_BALANCE_MISMATCH");
    }
    async function assertTransfer(f, id, amount = "200", fee = "25") {
        const saved = await db.transfer.findUnique({ where: { id } });
        check(saved?.userId === f.a.id && saved.fromWalletId === f.source.id && saved.toWalletId === f.target.id, "MYSQL_TRANSFER_OWNER_MISMATCH");
        check(money(saved.amount) === money(amount) && money(saved.fee) === money(fee), "MYSQL_TRANSFER_DECIMAL_MISMATCH");
        const fees = await db.transaction.findMany({ where: { transferId: id } });
        check(fees.length === (fee === "0" ? 0 : 1), "MYSQL_FEE_COUNT_MISMATCH");
        if (fees.length) check(fees[0].type === "EXPENSE" && money(fees[0].amount) === money(fee) && fees[0].walletId === f.source.id, "MYSQL_FEE_MISMATCH");
    }
    async function assertEmpty(f) {
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 0, "MYSQL_UNEXPECTED_TRANSFER");
        check(await db.transaction.count({ where: { userId: f.a.id } }) === 0, "MYSQL_UNEXPECTED_TRANSACTION");
    }
    async function scenario(id, evidence, run) {
        if (process.env.WHYLET_TEST_ONLY && process.env.WHYLET_TEST_ONLY !== id) {
            results.push({ id, status: "NOT TESTED", reason: "NOT_SELECTED" });
            return;
        }
        try { await run(); results.push({ id, status: "PASS", evidence }); }
        catch (error) { results.push({ id, status: "FAIL", reason: error instanceof CheckFailure ? error.message : "SCENARIO_FAILED_DETAIL_REDACTED" }); }
    }

    await scenario("DB-01", "HTTP 201; MySQL 2 transaksi; saldo API/SQL 1300.00.", async () => {
        const f = await fixture("01");
        for (const [type, amount] of [["INCOME", "500"], ["EXPENSE", "200"]]) {
            const res = await api(f.auth, "post", "/transactions", transaction(f, type, amount));
            status(res, 201);
            const row = await db.transaction.findUnique({ where: { id: res.body.data.id } });
            check(row?.userId === f.a.id && row.type === type && money(row.amount) === money(amount), "MYSQL_TRANSACTION_MISMATCH");
        }
        check(await db.transaction.count({ where: { userId: f.a.id } }) === 2, "MYSQL_TRANSACTION_COUNT_MISMATCH");
        await assertBalance(f.auth, f.source.id, "1300.00");
    });
    await scenario("DB-02", "HTTP PATCH/DELETE 200; saldo API/SQL 1250.00 lalu 1500.00; row terhapus.", async () => {
        const f = await fixture("02");
        status(await api(f.auth, "post", "/transactions", transaction(f, "INCOME", "500")), 201);
        const expense = await api(f.auth, "post", "/transactions", transaction(f, "EXPENSE", "200"));
        status(expense, 201);
        const id = expense.body.data.id;
        status(await api(f.auth, "patch", `/transactions/${id}`, { amount: "250" }), 200);
        check(money((await db.transaction.findUnique({ where: { id } })).amount) === "250.00", "MYSQL_EDIT_MISMATCH");
        await assertBalance(f.auth, f.source.id, "1250.00");
        status(await api(f.auth, "delete", `/transactions/${id}`), 200);
        check(await db.transaction.findUnique({ where: { id } }) === null, "MYSQL_DELETE_FAILED");
        await assertBalance(f.auth, f.source.id, "1500.00");
    });
    await scenario("DB-03", "HTTP 201; transfer/biaya 1/1; saldo API/SQL 775.00 dan 200.00.", async () => {
        const f = await fixture("03");
        const res = await api(f.auth, "post", "/transfers", transfer(f), { key: randomUUID() });
        status(res, 201);
        check(res.body.data.amount === "200.00" && res.body.data.fee === "25.00" && res.body.data.totalDeduction === "225.00", "API_TRANSFER_DECIMAL_MISMATCH");
        await assertTransfer(f, res.body.data.id);
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 1, "MYSQL_TRANSFER_COUNT_MISMATCH");
        await assertBalance(f.auth, f.source.id, "775.00");
        await assertBalance(f.auth, f.target.id, "200.00");
    });
    await scenario("DB-04", "Replay setelah commit: HTTP 201, ID sama, transfer/biaya tetap 1/1, saldo tetap.", async () => {
        const f = await fixture("04");
        const key = randomUUID();
        // Abaikan payload respons pertama seperti klien yang kehilangan respons sesudah commit.
        status(await api(f.auth, "post", "/transfers", transfer(f), { key }), 201);
        const res = await api(f.auth, "post", "/transfers", transfer(f), { key });
        status(res, 201);
        check(res.body.data.id === key, "API_REPLAY_ID_MISMATCH");
        await assertTransfer(f, key);
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 1, "MYSQL_REPLAY_DUPLICATE");
        await assertBalance(f.auth, f.source.id, "775.00");
        await assertBalance(f.auth, f.target.id, "200.00");
    });
    await scenario("DB-05", "Dua HTTP bersamaan key sama: 201/201; ID sama; transfer/biaya 1/1; debit sekali.", async () => {
        const f = await fixture("05");
        const key = randomUUID();
        const responses = await Promise.all([1, 2].map(() => api(f.auth, "post", "/transfers", transfer(f), { key })));
        for (const res of responses) { status(res, 201); check(res.body.data.id === key, "API_CONCURRENT_ID_MISMATCH"); }
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 1, "MYSQL_CONCURRENT_DUPLICATE");
        await assertTransfer(f, key);
        await assertBalance(f.auth, f.source.id, "775.00");
        await assertBalance(f.auth, f.target.id, "200.00");
    });
    await scenario("DB-06", "Payload berbeda/pengguna berbeda HTTP 409; data tidak bocor; saldo dan row tetap.", async () => {
        const f = await fixture("06");
        const key = randomUUID();
        status(await api(f.auth, "post", "/transfers", transfer(f), { key }), 201);
        for (const change of [{ amount: "201" }, { toWalletId: f.source.id, fromWalletId: f.target.id }, { note: "Catatan berbeda" }]) {
            status(await api(f.auth, "post", "/transfers", { ...transfer(f), ...change }, { key }), 409);
        }
        const other = await login(f.b);
        const res = await api(other, "post", "/transfers", transfer(f), { key });
        status(res, 409);
        check(!res.body.data, "API_FOREIGN_DATA_LEAK");
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 1 && await db.transfer.count({ where: { userId: f.b.id } }) === 0, "MYSQL_REPLAY_OWNER_MISMATCH");
        await assertTransfer(f, key);
        await assertBalance(f.auth, f.source.id, "775.00");
        await assertBalance(other, f.foreign.id, "1000.00");
    });
    await scenario("DB-07", "Pengeluaran berlebih HTTP 400; rollback MySQL menyisakan 0 transaksi; saldo 1000.00.", async () => {
        const f = await fixture("07");
        status(await api(f.auth, "post", "/transactions", transaction(f, "EXPENSE", "1001")), 400);
        await assertEmpty(f);
        await assertBalance(f.auth, f.source.id, "1000.00");
    });
    await scenario("DB-08", "FK MySQL nyata setelah INSERT transfer: HTTP 500; rollback 0 transfer/biaya; saldo API/SQL 1000.00 dan 0.00.", async () => {
        const f = await fixture("08");
        const constraints = await db.$queryRaw`
            SELECT COUNT(*) AS total FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
              AND COLUMN_NAME = 'category_id' AND REFERENCED_TABLE_SCHEMA = DATABASE()
              AND REFERENCED_TABLE_NAME = 'categories' AND REFERENCED_COLUMN_NAME = 'id'`;
        check(Number(constraints[0].total) === 1, "MYSQL_CATEGORY_FK_MISSING");
        const engines = await db.$queryRaw`
            SELECT ENGINE AS engine FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('transactions', 'transfers')`;
        check(engines.length === 2 && engines.every(row => row.engine === "InnoDB"), "MYSQL_TRANSACTION_ENGINE_INVALID");
        const original = appDb.$transaction;
        const key = randomUUID();
        const missingCategoryId = randomUUID();
        check(await db.category.findUnique({ where: { id: missingCategoryId } }) === null, "FAULT_CATEGORY_ALREADY_EXISTS");
        let attemptedAfterInsert = false;
        let observedForeignKeyFailure = false;
        // Wrapper hanya di worker; operasi INSERT fee tetap dijalankan oleh MySQL nyata.
        appDb.$transaction = function (callback, options) {
            return original.call(appDb, async tx => {
                const checks = await tx.$queryRaw`SELECT @@SESSION.foreign_key_checks AS enabled`;
                check(Number(checks[0].enabled) === 1, "MYSQL_FK_CHECKS_DISABLED");
                const wrapped = new Proxy(tx, { get(target, property) {
                    if (property !== "transaction") return Reflect.get(target, property);
                    return new Proxy(target.transaction, { get(delegate, method) {
                        if (method !== "create") return Reflect.get(delegate, method);
                        return async args => {
                            if (!args.data.transferId) return delegate.create(args);
                            const inserted = await tx.transfer.findUnique({ where: { id: args.data.transferId } });
                            attemptedAfterInsert = Boolean(inserted?.id === key && inserted.userId === f.a.id &&
                                money(inserted.amount) === "200.00" && money(inserted.fee) === "25.00");
                            try { return await delegate.create({ ...args, data: { ...args.data, categoryId: missingCategoryId } }); }
                            catch (error) { observedForeignKeyFailure = isForeignKeyFailure(error); throw error; }
                        };
                    } });
                } });
                return callback(wrapped);
            }, options);
        };
        let response;
        try { response = await api(f.auth, "post", "/transfers", transfer(f), { key }); }
        finally { appDb.$transaction = original; }
        // Verifikasi rollback walaupun bukti fault injection tidak sesuai ekspektasi.
        await assertEmpty(f);
        check(await db.transfer.findUnique({ where: { id: key } }) === null, "MYSQL_FAILED_TRANSFER_PERSISTED");
        check(await db.transaction.count({ where: { transferId: key } }) === 0, "MYSQL_FAILED_FEE_PERSISTED");
        check(await db.category.count({ where: { userId: f.a.id, name: "Biaya Transfer" } }) === 0, "MYSQL_FEE_CATEGORY_NOT_ROLLED_BACK");
        await assertBalance(f.auth, f.source.id, "1000.00");
        await assertBalance(f.auth, f.target.id, "0.00");
        status(response, 500);
        check(attemptedAfterInsert && observedForeignKeyFailure, "REAL_MYSQL_FK_FAILURE_NOT_OBSERVED");
    });
    await scenario("DB-09", "Akses lintas akun ditolak; daftar/laporan terisolasi; saldo dan record B tetap.", async () => {
        const f = await fixture("09");
        const other = await login(f.b);
        const own = await api(f.auth, "post", "/transactions", transaction(f, "EXPENSE", "20")); status(own, 201);
        const foreign = await api(other, "post", "/transactions", { ...transaction(f, "EXPENSE", "10", f.foreign.id), categoryId: f.otherExpense.id }); status(foreign, 201);
        const id = foreign.body.data.id;
        for (const [method, path, body] of [
            ["get", `/wallets/${f.foreign.id}`], ["patch", `/wallets/${f.foreign.id}`, { name: "Ubah asing" }],
            ["patch", `/wallets/${f.foreign.id}/archive`], ["get", `/transactions/${id}`],
            ["patch", `/transactions/${id}`, { amount: "11" }], ["delete", `/transactions/${id}`]
        ]) status(await api(f.auth, method, path, body), 404);
        status(await api(f.auth, "post", "/transfers", { ...transfer(f), toWalletId: f.foreign.id }, { key: randomUUID() }), 404);
        status(await api(f.auth, "post", "/transactions", { ...transaction(f, "EXPENSE", "1"), categoryId: f.otherExpense.id }), 400);
        const list = await api(f.auth, "get", "/transactions"); status(list, 200);
        check(list.body.data.items.length === 1 && list.body.data.items[0].id === own.body.data.id, "API_LIST_DATA_LEAK");
        const wallets = await api(f.auth, "get", "/wallets"); status(wallets, 200);
        check(wallets.body.data.every(w => w.id !== f.foreign.id), "API_WALLET_DATA_LEAK");
        const report = await api(f.auth, "get", `/reports/categories?month=${date.slice(0, 7)}&type=EXPENSE`); status(report, 200);
        check(report.body.data.total === "20.00" && report.body.data.categories.every(c => c.categoryId !== f.otherExpense.id), "API_REPORT_DATA_LEAK");
        check(money((await db.transaction.findUnique({ where: { id } })).amount) === "10.00", "MYSQL_FOREIGN_MUTATION");
        check(!(await db.wallet.findUnique({ where: { id: f.foreign.id } })).isArchived, "MYSQL_FOREIGN_ARCHIVE");
        check(await db.transaction.count({ where: { userId: f.b.id } }) === 1, "MYSQL_FOREIGN_COUNT_MISMATCH");
        await assertBalance(f.auth, f.source.id, "980.00");
        await assertBalance(other, f.foreign.id, "990.00");
    });
    await scenario("DB-10", "Dua key berbeda berebut saldo: tepat satu 201; lainnya 400/409; saldo 300.00 dan 700.00.", async () => {
        const f = await fixture("10");
        const responses = await Promise.all([1, 2].map(() => api(f.auth, "post", "/transfers", transfer(f, "700", "0"), { key: randomUUID() })));
        check(responses.filter(r => r.status === 201).length === 1 && responses.every(r => [201, 400, 409].includes(r.status)), "API_OVERSPEND_CONCURRENCY_FAILED");
        check(await db.transfer.count({ where: { userId: f.a.id } }) === 1, "MYSQL_OVERSPEND_COUNT_MISMATCH");
        check(await db.transaction.count({ where: { userId: f.a.id } }) === 0, "MYSQL_ZERO_FEE_TRANSACTION");
        await assertTransfer(f, responses.find(r => r.status === 201).body.data.id, "700", "0");
        await assertBalance(f.auth, f.source.id, "300.00");
        await assertBalance(f.auth, f.target.id, "700.00");
    });
    await scenario("DB-11", "Login/cookie/CSRF valid; CSRF salah 403; logout mencabut row sesi; cookie lama 401.", async () => {
        const f = await fixture("11");
        const invalid = await request(app).post("/api/v1/auth/login").set("Origin", origin).send({ email: f.a.email, password: randomBytes(24).toString("hex") });
        status(invalid, 401);
        const before = await db.authSession.count({ where: { userId: f.a.id, revokedAt: null } });
        check(before === 1, "MYSQL_SESSION_MISSING");
        const session = await db.authSession.findFirst({ where: { userId: f.a.id, revokedAt: null } });
        check(session.expiresAt > new Date() && session.csrfNonce.length === 64, "MYSQL_SESSION_INVALID");
        const body = { name: "Dompet CSRF", type: "CASH", openingBalance: "0" };
        const count = await db.wallet.count({ where: { userId: f.a.id } });
        status(await api(f.auth, "post", "/wallets", body, { csrf: null }), 403);
        status(await api(f.auth, "post", "/wallets", body, { csrf: "invalid" }), 403);
        check(await db.wallet.count({ where: { userId: f.a.id } }) === count, "MYSQL_CSRF_MUTATION");
        status(await api(f.auth, "post", "/wallets", body), 201);
        check(await db.wallet.count({ where: { userId: f.a.id } }) === count + 1, "MYSQL_VALID_CSRF_MISSING");
        status(await api(f.auth, "post", "/auth/logout"), 200);
        check((await db.authSession.findUnique({ where: { id: session.id } })).revokedAt !== null, "MYSQL_SESSION_NOT_REVOKED");
        status(await api(f.auth, "get", "/auth/me"), 401);
        status(await api(f.auth, "get", "/wallets"), 401);
        status(await api(f.auth, "post", "/wallets", body), 401);
        check(await db.wallet.count({ where: { userId: f.a.id } }) === count + 1, "MYSQL_REVOKED_SESSION_MUTATION");
    });
} catch {
    // Semua detail exception/koneksi sengaja tidak diteruskan ke hasil.
} finally {
    for (let i = 1; i <= 11; i++) {
        const id = `DB-${String(i).padStart(2, "0")}`;
        if (!results.some(r => r.id === id)) results.push({ id, status: "NOT TESTED", reason: "WORKER_PREFLIGHT_FAILED_OR_INTERRUPTED" });
    }
    if (appDb) await appDb.$disconnect().catch(() => {});
    if (db) await db.$disconnect().catch(() => {});
    console.error = originalError;
    output({ runId, results });
    process.exitCode = results.every(r => r.status === "PASS" || r.reason === "NOT_SELECTED") ? 0 : 1;
}
