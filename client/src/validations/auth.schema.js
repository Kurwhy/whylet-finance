import { z } from "zod";
import { passwordSchema } from "./account.schema";

const emailSchema = z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Masukkan alamat email yang valid.")
    .max(191, "Email terlalu panjang.");

export const loginSchema = z.object({
    email: emailSchema,

    password: z
        .string()
        .min(1, "Kata sandi wajib diisi.")
});

export const registerSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Nama lengkap wajib diisi.")
            .min(3, "Nama minimal 3 karakter.")
            .max(100, "Nama maksimal 100 karakter."),

        email: emailSchema,

        password: passwordSchema,

        confirmPassword: z.string().min(
            1,
            "Konfirmasi kata sandi wajib diisi."
        )
    })
    .refine(
        (data) => data.password === data.confirmPassword,
        {
            message: "Konfirmasi kata sandi tidak sama.",
            path: ["confirmPassword"]
        }
    );
