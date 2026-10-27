import { z } from "zod";

// Maksimal 16 digit sebelum koma dan 2 digit sesudah koma.
// Sesuaikan batas bisnis ini dengan validator backend.
const MONEY_REGEX = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

// Nominal memakai digit dan titik desimal; jangan menghapus titik karena
// "12500.50" akan berubah nilainya menjadi "1250050".
export function normalizeMoneyInput(value) {
    return typeof value === "string" ? value.trim() : "";
}

// Validator untuk input nominal dalam format digit.
// Contoh valid: 25000, 150000, 12500.50
export const moneySchema = z
    .string()
    .trim()
    .min(1, "Nominal wajib diisi.")
    .regex(
        MONEY_REGEX,
        "Masukkan nominal yang valid, misalnya 25000."
    )
    .refine(
        (value) => {
            if (!MONEY_REGEX.test(value)) return false;

            const [integer, fraction = ""] = value.split(".");

            return (
                integer.replace(/^0+/, "") !== "" ||
                /[1-9]/.test(fraction)
            );
        },
        "Nominal harus lebih dari Rp0."
    );


export const walletSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Nama dompet wajib diisi.")
        .min(3, "Nama dompet minimal 3 karakter.")
        .max(100, "Nama dompet maksimal 100 karakter."),

    type: z.enum(["CASH", "BANK", "EWALLET", "OTHER"], {
        error: "Pilih jenis dompet yang valid."
    }),

    openingBalance: z
        .string()
        .trim()
        .min(1, "Saldo awal wajib diisi.")
        .regex(
            /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/,
            "Saldo awal harus berupa angka positif atau nol."
        )
});


export const transactionSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"], {
        error: "Pilih jenis transaksi."
    }),

    walletId: z.string()
        .uuid("Pilih dompet yang valid."),

    categoryId: z.string()
        .uuid("Pilih kategori yang valid."),

    amount: moneySchema,

    description: z.string()
        .trim()
        .min(1, "Keterangan wajib diisi.")
        .max(255, "Keterangan maksimal 255 karakter."),

    transactionDate: z.iso.date({
        error: "Pilih tanggal transaksi yang valid."
    })
});

export const transferSchema = z.object({
    fromWalletId: z.string().uuid("Pilih dompet asal."),
    toWalletId: z.string().uuid("Pilih dompet tujuan."),
    amount: moneySchema,

    fee: z.string()
        .regex(
            MONEY_REGEX,
            "Biaya admin harus berupa nominal yang valid."
        )
        .default("0"),

    transferDate: z.iso.date({ error: "Pilih tanggal transfer yang valid." }),

    note: z.string()
        .trim()
        .max(255, "Catatan maksimal 255 karakter.")
        .optional()
}).refine(
    (data) => data.fromWalletId !== data.toWalletId,
    {
        path: ["toWalletId"],
        message: "Dompet tujuan harus berbeda dari dompet asal."
    }
);

export const spendingLimitSchema = z.object({
    amount: z.string().trim().regex(/^[1-9]\d{0,15}(?:\.\d{1,2})?$/, "Masukkan batas pengeluaran minimal Rp1 tanpa pemisah ribuan."),
    isEnabled: z.boolean()
});

export const walletEditSchema = walletSchema.pick({ name: true, type: true });
