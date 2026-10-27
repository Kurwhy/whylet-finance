import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { publicUser } from "../utils/auth.js";
import { hashToken } from "./auth-session.service.js";
import { sendPasswordResetEmail } from "./email.service.js";
export class AccountError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}
async function atomic(action) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return await prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
        catch (error) { if (error.code !== "P2034" || attempt === 2) throw error; }
    }
}
// Seluruh operasi perubahan kata sandi mengunci pengguna sebelum token/sesi.
async function lockUser(tx, id) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
    return tx.user.findUnique({ where: { id } });
}
async function revokeCredentials(tx, userId) {
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}
export async function getProfile(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { settings: true } });
    return { ...publicUser(user), hasPassword: Boolean(user.passwordHash), currency: user.settings?.currency || "IDR", timezone: user.settings?.timezone || "Asia/Jakarta" };
}
export async function updateProfile(userId, data) {
    await prisma.user.update({ where: { id: userId }, data: { name: data.name } });
    return getProfile(userId);
}
export async function changePassword(userId, data) {
    const hash = await bcrypt.hash(data.password, 12);
    await atomic(async tx => {
        const user = await lockUser(tx, userId);
        if (!user?.passwordHash) throw new AccountError("Akun ini menggunakan Google. Perubahan kata sandi biasa tidak tersedia.");
        if (!await bcrypt.compare(data.currentPassword, user.passwordHash)) throw new AccountError("Kata sandi saat ini tidak sesuai.");
        await tx.user.update({ where: { id: userId }, data: { passwordHash: hash } });
        await revokeCredentials(tx, userId);
    });
}
export async function requestPasswordReset(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Respons controller selalu sama; akun Google-only tidak dibuatkan password baru.
    if (!user?.passwordHash) return;
    const raw = crypto.randomBytes(32).toString("hex");
    await atomic(async tx => {
        const current = await lockUser(tx, user.id);
        if (!current?.passwordHash) return;
        await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 30 * 60000) } });
    });
    try { await sendPasswordResetEmail(user.email, raw); }
    catch { console.error({ event: "password_reset_email_failed" }); } // Tidak membocorkan eksistensi akun/secret SMTP.
}
export async function resetPassword(data) {
    const tokenHash = hashToken(data.token);
    // Lookup hanya mengidentifikasi pemilik. Jangan mengambil shared lock token
    // sebelum user FOR UPDATE: itu membalik urutan lock dengan operasi reset lain.
    const candidate = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!candidate) throw new AccountError("Tautan reset tidak valid atau kedaluwarsa.");
    const hash = await bcrypt.hash(data.password, 12);
    await atomic(async tx => {
        const user = await lockUser(tx, candidate.userId);
        if (!user?.passwordHash) throw new AccountError("Tautan reset tidak valid atau kedaluwarsa.");
        const consumed = await tx.passwordResetToken.updateMany({ where: { id: candidate.id, userId: candidate.userId, tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (consumed.count !== 1) throw new AccountError("Tautan reset tidak valid atau kedaluwarsa.");
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
        await revokeCredentials(tx, user.id);
    });
}
