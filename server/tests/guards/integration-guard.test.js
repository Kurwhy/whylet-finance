import test from "node:test";
import assert from "node:assert/strict";
import { validateTestUrl, validateGrants, verifyTestDatabase } from "../integration/guard.js";

// Identitas di bawah hanya fixture unit, bukan akun MySQL aktual.
const grants = ["GRANT USAGE ON *.* TO `fixture`@`localhost`", "GRANT SELECT, INSERT, UPDATE, DELETE ON `whylet\\_test`.* TO `fixture`@`localhost`"];
test("guard menerima URL testing lokal eksplisit", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.ok(validateTestUrl(`mysql://fixture:dummy@${host}:3306/whylet_test`));
});
test("guard menolak URL kosong, database utama, host remote, root dan opsi routing", () => {
    for (const url of [undefined, "invalid", "mysql://fixture:dummy@localhost/whylet_db", "mysql://fixture:dummy@localhost/production", "mysql://fixture:dummy@example.com/whylet_test", "mysql://root:dummy@localhost/whylet_test", "mysql://fixture:dummy@localhost/whylet_test?socket=/tmp/mysql.sock", "mysql://fixture:dummy@localhost/whylet_test?schema=whylet_db", "mysql://fixture:dummy@localhost/whylet_test#x", "postgres://fixture:dummy@localhost/whylet_test"]) assert.throws(() => validateTestUrl(url));
});
test("guard menerima hanya grant schema testing tanpa wildcard atau grant option", () => {
    assert.equal(validateGrants(grants), true);
    for (const extra of ["GRANT ALL PRIVILEGES ON *.* TO `fixture`@`localhost`", "GRANT SELECT ON `whylet_test`.* TO `fixture`@`localhost`", "GRANT SELECT ON `whylet_db`.* TO `fixture`@`localhost`", "GRANT `role`@`%` TO `fixture`@`localhost`", "GRANT SELECT ON `whylet\\_test`.* TO `fixture`@`localhost` WITH GRANT OPTION"]) assert.throws(() => validateGrants([...grants, extra]));
    assert.throws(() => validateGrants([grants[0]]));
    assert.throws(() => validateGrants(grants, { migration: true }));
});
test("guard menolak hasil database dan role yang tidak sesuai (unit dengan mock)", async () => {
    const db = (database, roles = "NONE", mandatoryRoles = "") => ({
        $queryRawUnsafe: async sql => sql.includes("DATABASE()") ? [{ db: database }] : sql.includes("CURRENT_ROLE") ? [{ roles, mandatoryRoles }] : grants.map(g => ({ grant: g }))
    });
    assert.equal(await verifyTestDatabase(db("whylet_test")), true);
    await assert.rejects(verifyTestDatabase(db("whylet_db")));
    await assert.rejects(verifyTestDatabase(db("whylet_test", "role")));
    await assert.rejects(verifyTestDatabase(db("whylet_test", "NONE", "role")));
});
