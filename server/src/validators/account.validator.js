import { z } from "zod";
export const passwordSchema = z.string().min(8, "Kata sandi minimal 8 karakter.")
    .max(72, "Kata sandi maksimal 72 byte.")
    .refine(value => Buffer.byteLength(value, "utf8") <= 72, "Kata sandi maksimal 72 byte.")
    .regex(/[A-Z]/, "Gunakan minimal satu huruf kapital.")
    .regex(/[a-z]/, "Gunakan minimal satu huruf kecil.")
    .regex(/[0-9]/, "Gunakan minimal satu angka.");
export const profileSchema = z.object({ name: z.string().trim().min(3, "Nama minimal 3 karakter.").max(100, "Nama maksimal 100 karakter.") }).strict();
const confirmation = (value, context) => { if (value.password !== value.confirmPassword) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak cocok." }); };
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi.").max(128, "Kata sandi saat ini maksimal 128 karakter."), password: passwordSchema, confirmPassword: z.string() }).strict().superRefine(confirmation);
export const forgotPasswordSchema = z.object({ email: z.string().trim().email("Alamat email tidak valid.").max(191, "Alamat email maksimal 191 karakter.").toLowerCase() }).strict();
export const resetPasswordSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i, "Tautan reset tidak valid."), password: passwordSchema, confirmPassword: z.string() }).strict().superRefine(confirmation);
