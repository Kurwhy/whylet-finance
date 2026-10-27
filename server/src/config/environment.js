export function assertEnvironment(env = process.env) {
    if (env.NODE_ENV !== "production") return;
    const reject = () => { throw new Error("Konfigurasi production tidak lengkap atau tidak aman. Periksa dokumentasi deployment tanpa mencetak secret."); };
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || !env.CSRF_SECRET || env.CSRF_SECRET.length < 32 || env.JWT_SECRET === env.CSRF_SECRET) reject();
    try {
        const origin = new URL(env.CLIENT_URL);
        const db = new URL(env.DATABASE_URL);
        if (origin.protocol !== "https:" || origin.origin !== env.CLIENT_URL || origin.username || origin.password || db.protocol !== "mysql:" || !db.username || !db.password || db.pathname === "/") reject();
    } catch { reject(); }
    if (!env.SMTP_HOST || !env.MAIL_FROM || !/^[^\s@]+@[^\s@]+$/.test(env.MAIL_FROM) || !/^[0-9]+$/.test(env.SMTP_PORT || "") || Number(env.SMTP_PORT) < 1 || Number(env.SMTP_PORT) > 65535) reject();
}
