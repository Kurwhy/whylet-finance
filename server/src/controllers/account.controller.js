import * as service from "../services/account.service.js";
import { profileSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/account.validator.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../services/auth-session.service.js";
function parse(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) throw new service.AccountError(result.error.issues[0].message);
    return result.data;
}
function failed(error, res, next) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    if (error.code === "P2034") return res.status(409).json({ success: false, message: "Terjadi konflik data. Silakan coba lagi." });
    next(error);
}
const clearSession = res => res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: sessionCookieOptions.httpOnly, secure: sessionCookieOptions.secure, sameSite: sessionCookieOptions.sameSite, path: sessionCookieOptions.path });
export async function show(req, res, next) {
    try { res.json({ success: true, data: await service.getProfile(req.user.id) }); } catch (error) { failed(error, res, next); }
}
export async function update(req, res, next) {
    try { res.json({ success: true, message: "Nama berhasil diperbarui.", data: await service.updateProfile(req.user.id, parse(profileSchema, req.body)) }); } catch (error) { failed(error, res, next); }
}
export async function changePassword(req, res, next) {
    try { await service.changePassword(req.user.id, parse(changePasswordSchema, req.body)); clearSession(res); res.json({ success: true, message: "Kata sandi diubah. Silakan masuk kembali." }); } catch (error) { failed(error, res, next); }
}
export async function forgotPassword(req, res, next) {
    try { await service.requestPasswordReset(parse(forgotPasswordSchema, req.body).email); res.json({ success: true, message: "Jika akun memenuhi syarat, tautan reset akan dikirim. Periksa kotak masuk." }); } catch (error) { failed(error, res, next); }
}
export async function resetPassword(req, res, next) {
    try { await service.resetPassword(parse(resetPasswordSchema, req.body)); clearSession(res); res.json({ success: true, message: "Kata sandi direset. Silakan masuk kembali." }); } catch (error) { failed(error, res, next); }
}
