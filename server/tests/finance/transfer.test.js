import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../../src/config/prisma.js";
import { createTransfer } from "../../src/services/transfer.service.js";
import { calculateBalance } from "../../src/services/wallet.service.js";

function mockMethod(t, object, key, implementation) {
    const original = object[key];
    object[key] = implementation;
    t.after(() => { object[key] = original; });
}

const id = "7c95b849-4139-49f7-926b-c87cd7ddffdb";
const data = { fromWalletId: "source", toWalletId: "target", amount: "200", fee: "25", transferDate: "2026-10-26", note: "Uji" };
const previous = { id, userId: "user", ...data, amount: new Prisma.Decimal(200), fee: new Prisma.Decimal(25), transferDate: new Date("2026-10-26T00:00:00Z") };

test("permintaan ulang mengembalikan transfer tanpa menyentuh saldo", async t => {
    let writes = 0;
    const tx = { transfer: { findUnique: async () => previous, create: async () => { writes++; } } };
    mockMethod(t, prisma, "$transaction", async fn => fn(tx));
    const result = await createTransfer("user", data, id);
    assert.equal(result.id, id);
    assert.equal(result.totalDeduction, "225.00");
    assert.equal(writes, 0);
});

test("kunci yang sama menolak perubahan isi dan pengguna lain", async t => {
    mockMethod(t, prisma, "$transaction", async fn => fn({ transfer: { findUnique: async () => previous } }));
    for (const changed of [{ ...data, amount: "201" }, { ...data, fee: "0" }, { ...data, toWalletId: "other" }, { ...data, transferDate: "2026-10-25" }, { ...data, note: "Lain" }]) {
        await assert.rejects(createTransfer("user", changed, id), e => e.status === 409);
    }
    await assert.rejects(createTransfer("other-user", data, id), e => e.status === 409);
});

test("perlombaan primary key mengembalikan transfer yang sudah tersimpan", async t => {
    mockMethod(t, prisma, "$transaction", async () => { throw Object.assign(new Error(), { code: "P2002" }); });
    mockMethod(t, prisma.transfer, "findUnique", async () => previous);
    assert.equal((await createTransfer("user", data, id)).id, id);
});

test("biaya transfer dihitung sekali pada saldo baru maupun data lama", async () => {
    const db = {
        transaction: { aggregate: async ({ where }) => ({ _sum: { amount: where.type === "EXPENSE" ? "25" : "0" } }) },
        transfer: {
            findMany: async () => [{ amount: "200", fee: "25", feeTransaction: { id: "fee" } }],
            aggregate: async () => ({ _sum: { amount: "0" } })
        }
    };
    assert.equal(await calculateBalance(db, { id: "source", openingBalance: "1000" }), "775.00");
    db.transaction.aggregate = async () => ({ _sum: { amount: "0" } });
    db.transfer.findMany = async () => [{ amount: "200", fee: "25", feeTransaction: null }];
    assert.equal(await calculateBalance(db, { id: "source", openingBalance: "1000" }), "775.00");
});

test("saldo kurang ditolak sebelum transfer dibuat", async t => {
    let writes = 0;
    const tx = {
        wallet: { findFirst: async () => ({ id: "source", openingBalance: "100" }) },
        transaction: { aggregate: async () => ({ _sum: { amount: null } }) },
        transfer: {
            findUnique: async () => null,
            findMany: async () => [],
            aggregate: async () => ({ _sum: { amount: null } }),
            create: async () => { writes++; }
        }
    };
    mockMethod(t, prisma, "$transaction", async fn => fn(tx));
    await assert.rejects(createTransfer("user", data, id), /tidak mencukupi/);
    assert.equal(writes, 0);
});

test("transfer baru menyimpan kunci dan biaya dalam transaksi serializable", async t => {
    let stored;
    const fees = [];
    let transactionOptions;
    const tx = {
        wallet: { findFirst: async ({ where }) => ({ id: where.id, openingBalance: "1000" }) },
        category: { upsert: async () => ({ id: "fee-category" }) },
        transaction: {
            aggregate: async ({ where }) => ({ _sum: { amount: where.type === "EXPENSE" && fees.length ? "25" : "0" } }),
            create: async ({ data }) => { fees.push(data); }
        },
        transfer: {
            findUnique: async () => stored,
            findMany: async () => stored ? [{ ...stored, feeTransaction: fees.length ? { id: "fee" } : null }] : [],
            aggregate: async () => ({ _sum: { amount: "0" } }),
            create: async ({ data }) => { stored = data; return data; }
        }
    };
    mockMethod(t, prisma, "$transaction", async (fn, options) => { transactionOptions = options; return fn(tx); });
    const result = await createTransfer("user", data, id);
    assert.equal(stored.id, id);
    assert.equal(stored.userId, "user");
    assert.equal(result.amount, "200.00");
    assert.equal(fees.length, 1);
    assert.equal(fees[0].transferId, id);
    assert.equal(fees[0].amount.toFixed(2), "25.00");
    assert.equal(transactionOptions.isolationLevel, "Serializable");
    assert.equal(await calculateBalance(tx, { id: "source", openingBalance: "1000" }), "775.00");
});
