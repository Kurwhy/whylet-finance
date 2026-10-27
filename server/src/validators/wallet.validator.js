import { z } from "zod";

const amountSchema = z.string().regex(
    /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/,
    "Saldo awal harus berupa nominal positif atau nol tanpa pemisah ribuan."
);

export const createWalletSchema = z.object({
    name: z.string().trim().min(3, "Nama dompet minimal 3 karakter.").max(100, "Nama dompet maksimal 100 karakter."),

    type: z.enum(["CASH", "BANK", "EWALLET", "OTHER"]),

    openingBalance: amountSchema.default("0")
}).strict();

export const updateWalletSchema = z.object({
    name: z.string().trim().min(3, "Nama dompet minimal 3 karakter.").max(100, "Nama dompet maksimal 100 karakter.").optional(),

    type: z.enum(["CASH", "BANK", "EWALLET", "OTHER"])
        .optional(),

    openingBalance: amountSchema.optional()
}).strict().refine(
    (value) => Object.keys(value).length > 0,
    "Minimal satu field harus diisi"
);
