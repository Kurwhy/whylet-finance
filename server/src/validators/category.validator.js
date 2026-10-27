import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(["INCOME", "EXPENSE"]),
    icon: z.string().max(50).nullable().optional()
}).strict();

export const updateCategorySchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    icon: z.string().max(50).nullable().optional()
}).strict().refine(
    (data) => Object.keys(data).length > 0,
    "Minimal satu field wajib diisi"
);
