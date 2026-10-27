import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { isForeignKeyFailure } from "../integration/fault-errors.js";
const known = code => new Prisma.PrismaClientKnownRequestError("Sintetis", { code, clientVersion: "test" });
const unknown = message => new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: "test" });

test("DB-08 mengenali FK P2003 dan FK MySQL SQLSTATE 23000 yang dibungkus connector", () => {
    assert.equal(isForeignKeyFailure(known("P2003")), true);
    assert.equal(isForeignKeyFailure(unknown('Query error: foreign key constraint fails; SQLSTATE 23000')), true);
});
test("DB-08 tidak menerima unique violation, timeout, atau SQLSTATE tanpa bukti FK", () => {
    for (const error of [known("P2002"), known("P2028"), unknown("Duplicate entry SQLSTATE 23000"), unknown("foreign key constraint fails"), unknown("Unknown query error")]) {
        assert.equal(isForeignKeyFailure(error), false);
    }
});
test("DB-08 tidak menerima error JavaScript atau object tiruan sebagai error connector", () => {
    const message = "foreign key constraint fails SQLSTATE 23000";
    for (const error of [new TypeError(message), new Error(message), { code: "P2003", message }, { name: "PrismaClientUnknownRequestError", message }]) {
        assert.equal(isForeignKeyFailure(error), false);
    }
});
