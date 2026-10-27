// Modul ini tidak memuat dotenv/config maupun konfigurasi aplikasi utama.
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DATA_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const MIGRATION_PRIVILEGES = [...DATA_PRIVILEGES, "CREATE", "ALTER", "DROP", "INDEX", "REFERENCES"];

export class GuardError extends Error {
    constructor(code) { super(code); this.code = code; }
}
const refuse = code => { throw new GuardError(code); };

export function validateTestUrl(raw) {
    if (!raw) refuse("TEST_URL_MISSING");
    let url;
    try { url = new URL(raw); } catch { refuse("TEST_URL_INVALID"); }
    if (url.protocol !== "mysql:") refuse("TEST_PROTOCOL_REJECTED");
    if (!ALLOWED_HOSTS.has(url.hostname)) refuse("TEST_HOST_REJECTED");
    if (url.pathname !== "/whylet_test") refuse("TEST_DATABASE_REJECTED");
    if (!url.username || decodeURIComponent(url.username).toLowerCase() === "root") refuse("TEST_ACCOUNT_REJECTED");
    // Opsi routing/socket/init command dapat mengalihkan koneksi: semuanya ditolak.
    if (url.search || url.hash) refuse("TEST_URL_OPTIONS_REJECTED");
    return raw;
}

export function validateGrants(grants, { migration = false } = {}) {
    if (!Array.isArray(grants) || grants.length === 0) refuse("TEST_GRANTS_MISSING");
    const privileges = new Set();
    for (const grant of grants) {
        if (typeof grant !== "string" || /WITH\s+GRANT\s+OPTION/i.test(grant)) refuse("TEST_GRANTS_REJECTED");
        // SHOW GRANTS dari MySQL 8. Akun dengan role/proxy/global privileges ditolak.
        const match = /^GRANT (.+) ON (.+) TO `(?:[^`]|``)+`@`(?:[^`]|``)+`$/i.exec(grant);
        if (!match) refuse("TEST_GRANTS_REJECTED");
        const [, list, scope] = match;
        if (scope === "*.*" && list === "USAGE") continue;
        // \_ wajib: underscore tanpa escape adalah wildcard grant MySQL.
        if (scope !== "`whylet\\_test`.*") refuse("TEST_GRANT_SCOPE_REJECTED");
        const allowed = new Set(MIGRATION_PRIVILEGES);
        for (const privilege of list.split(", ")) {
            if (!allowed.has(privilege)) refuse("TEST_GRANTS_REJECTED");
            privileges.add(privilege);
        }
    }
    const required = migration ? MIGRATION_PRIVILEGES : DATA_PRIVILEGES;
    if (!required.every(p => privileges.has(p))) refuse("TEST_GRANTS_INSUFFICIENT");
    return true;
}

export async function verifyTestDatabase(db, options) {
    const rows = await db.$queryRawUnsafe("SELECT DATABASE() AS db");
    if (rows.length !== 1 || rows[0].db !== "whylet_test") refuse("TEST_DATABASE_MISMATCH");
    const roles = await db.$queryRawUnsafe("SELECT CURRENT_ROLE() AS roles, @@GLOBAL.mandatory_roles AS mandatoryRoles");
    if (roles.length !== 1 || roles[0].roles !== "NONE" || !["", "NONE"].includes(roles[0].mandatoryRoles)) refuse("TEST_ROLES_REJECTED");
    const rowsOfGrants = await db.$queryRawUnsafe("SHOW GRANTS");
    validateGrants(rowsOfGrants.map(row => Object.values(row)[0]), options);
    return true;
}
