import test from "node:test";
import assert from "node:assert/strict";
import { walletSchema, walletEditSchema, transactionSchema, transferSchema, spendingLimitSchema } from "../src/validations/finance.schema.js";
const source = "7c95b849-4139-49f7-926b-c87cd7ddffdb";
const target = "6c95b849-4139-49f7-926b-c87cd7ddffdb";

test("dompet menerima nol dan menolak nominal rusak atau negatif", () => {
    for (const openingBalance of ["0", "0.01", "9999999999999999.99"]) assert.ok(walletSchema.safeParse({ name: "Tunai", type: "CASH", openingBalance }).success);
    for (const openingBalance of ["", "-1", "1e5", "25.000,00", "1.001", "10000000000000000"]) assert.equal(walletSchema.safeParse({ name: "Tunai", type: "CASH", openingBalance }).success, false);
    assert.equal(walletSchema.safeParse({ name: "Ab", type: "CASH", openingBalance: "0" }).success, false);
    assert.ok(walletEditSchema.safeParse({ name: "Tunai", type: "CASH" }).success);
});

test("transaksi memerlukan kategori, deskripsi, nominal positif dan tanggal nyata", () => {
    const data = { walletId: source, categoryId: target, type: "EXPENSE", amount: "0.01", description: "Makan", transactionDate: "2026-10-26" };
    assert.ok(transactionSchema.safeParse(data).success);
    for (const change of [{ categoryId: "" }, { description: "  " }, { amount: "0.00" }, { transactionDate: "2026-02-30" }]) assert.equal(transactionSchema.safeParse({ ...data, ...change }).success, false);
});

test("transfer memvalidasi dompet berbeda, biaya, dan tanggal", () => {
    const data = { fromWalletId: source, toWalletId: target, amount: "10", fee: "0", transferDate: "2026-10-26" };
    assert.ok(transferSchema.safeParse(data).success);
    for (const change of [{ toWalletId: source }, { fee: "-1" }, { amount: "0" }, { transferDate: "2026-02-30" }]) assert.equal(transferSchema.safeParse({ ...data, ...change }).success, false);
});

test("batas pengeluaran mengikuti format nominal backend", () => {
    assert.ok(spendingLimitSchema.safeParse({ amount: "100.50", isEnabled: false }).success);
    for (const amount of ["0", "0.50", "-100", "1.000,50"]) assert.equal(spendingLimitSchema.safeParse({ amount, isEnabled: true }).success, false);
});
