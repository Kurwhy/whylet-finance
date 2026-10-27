import { z } from "zod";
import { passwordSchema } from "./account.validator.js";

export const registerSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(3, "Nama lengkap minimal 3 karakter.")
            .max(100, "Nama lengkap maksimal 100 karakter."),

        email: z
            .string()
            .trim()
            .min(1, "Alamat email wajib diisi.")
            .email("Format alamat email tidak valid.")
            .max(191, "Alamat email terlalu panjang."),

        password: passwordSchema,

        confirmPassword: z
            .string()
            .min(1, "Konfirmasi kata sandi wajib diisi.")
    })
    .refine(
        (data) => data.password === data.confirmPassword,
        {
            path: ["confirmPassword"],
            message: "Konfirmasi kata sandi tidak cocok."
        }
    );

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Alamat email wajib diisi.")
        .email("Format email tidak valid")
        .toLowerCase(),

    password: z
        .string()
        .min(1, "Kata sandi wajib diisi")
});