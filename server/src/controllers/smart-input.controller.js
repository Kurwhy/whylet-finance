import { z } from "zod";
import { parseQuickText } from "../services/smart-input.service.js";

const quickTextSchema = z.object({
    text: z.string().trim().min(3).max(300)
}).strict();

export async function parseText(req, res, next) {
    try {
        const result = quickTextSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Teks transaksi harus berisi 3–300 karakter.",
                errors: result.error.flatten().fieldErrors
            });
        }

        const data = await parseQuickText(
            req.user.id,
            result.data.text
        );

        return res.json({
            success: true,
            message: "Draft transaksi berhasil dibuat",
            data
        });
    } catch (error) {
        next(error);
    }
}
