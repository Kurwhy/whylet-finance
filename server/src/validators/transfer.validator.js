import { z } from "zod";

const positiveAmount = z
    .string()
    .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/)
    .refine(v => Number(v) > 0, {
        message: "Nominal harus lebih dari nol"
    });

const nonNegativeAmount = z
    .string()
    .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);

export const createTransferSchema = z.object({
    fromWalletId: z.uuid(),
    toWalletId: z.uuid(),

    amount: positiveAmount,
    fee: nonNegativeAmount.default("0"),

    transferDate: z.iso.date(),

    note: z.string()
        .trim()
        .max(255)
        .optional()
}).strict().refine(
    data => data.fromWalletId !== data.toWalletId,
    {
        message: "Wallet asal dan tujuan harus berbeda",
        path: ["toWalletId"]
    }
);
