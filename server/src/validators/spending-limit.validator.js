import { z } from "zod";

const limitAmountSchema = z
    .string()
    .regex(
        /^(?:[1-9]\d{0,15})(?:\.\d{1,2})?$/,
        "Masukkan nominal positif tanpa pemisah ribuan"
    );

export const updateSpendingLimitSchema = z.object({
    amount: limitAmountSchema,
    isEnabled: z.boolean().default(true)
}).strict();

export const toggleSpendingLimitSchema = z.object({
    isEnabled: z.boolean()
}).strict();

export const spendingLimitQuerySchema = z.object({
    month: z.string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional()
}).strict();
