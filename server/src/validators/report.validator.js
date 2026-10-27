import { z } from "zod";

export const periodSchema = z.object({
    month: z.string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional()
}).strict();

export const categoryReportSchema = periodSchema.extend({
    type: z.enum(["INCOME", "EXPENSE"])
        .default("EXPENSE")
});

export const monthlyReportSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100)
        .optional()
}).strict();

export const exportReportSchema = periodSchema.extend({
    type: z.enum(["INCOME", "EXPENSE"]).optional()
});
