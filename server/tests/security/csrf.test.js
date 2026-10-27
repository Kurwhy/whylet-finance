
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
    createCsrfToken,
    verifyCsrfToken
} from "../../src/services/auth-session.service.js";

test("CSRF token valid untuk sesi yang benar", () => {
    process.env.CSRF_SECRET = "test-secret-minimum-32-karakter-aman";

    const session = {
        id: "session-A",
        csrfNonce: crypto.randomBytes(32).toString("hex")
    };

    const token = createCsrfToken(
        session.id,
        session.csrfNonce
    );

    assert.equal(
        verifyCsrfToken(session, token),
        true
    );
});

test("CSRF token tidak berlaku pada sesi lain", () => {
    process.env.CSRF_SECRET = "test-secret-minimum-32-karakter-aman";

    const sessionA = {
        id: "session-A",
        csrfNonce: crypto.randomBytes(32).toString("hex")
    };

    const sessionB = {
        id: "session-B",
        csrfNonce: crypto.randomBytes(32).toString("hex")
    };

    const tokenA = createCsrfToken(
        sessionA.id,
        sessionA.csrfNonce
    );

    assert.equal(
        verifyCsrfToken(sessionB, tokenA),
        false
    );
});

test("CSRF token yang dimodifikasi ditolak", () => {
    process.env.CSRF_SECRET = "test-secret-minimum-32-karakter-aman";

    const session = {
        id: "session-A",
        csrfNonce: crypto.randomBytes(32).toString("hex")
    };

    const token = createCsrfToken(
        session.id,
        session.csrfNonce
    );

    const replacement = token.endsWith("a") ? "b" : "a";
    const changed = token.slice(0, -1) + replacement;

    assert.equal(
        verifyCsrfToken(session, changed),
        false
    );
});

test("CSRF token kosong ditolak", () => {
    process.env.CSRF_SECRET = "test-secret-minimum-32-karakter-aman";

    assert.equal(
        verifyCsrfToken({
            id: "session-A",
            csrfNonce: crypto.randomBytes(32).toString("hex")
        }, ""),
        false
    );
});
