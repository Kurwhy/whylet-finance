import { z } from "zod";

const amountSchema = z.string()
    .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/)
    .refine(v => Number(v) > 0, "Nominal harus lebih dari nol");

const dateSchema = z.iso.date();

const fields = {
    walletId: z.uuid(),
    categoryId: z.uuid(),
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: amountSchema,
    description: z.string().trim().min(1).max(255),
    transactionDate: dateSchema,
    inputMethod: z.enum([
        "MANUAL",
        "TEXT",
        "VOICE",
        "RECEIPT"
    ]).default("MANUAL")
};

export const createTransactionSchema =
    z.object(fields).strict();

export const updateTransactionSchema =
    z.object({
        walletId: fields.walletId.optional(),
        categoryId: fields.categoryId.optional(),
        type: fields.type.optional(),
        amount: amountSchema.optional(),
        description: fields.description.optional(),
        transactionDate: dateSchema.optional()
    }).strict().refine(
        data => Object.keys(data).length > 0,
        "Minimal satu field harus diisi"
    );
