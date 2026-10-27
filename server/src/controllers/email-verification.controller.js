import { z } from "zod";

import {
    issueVerificationEmail,
    verifyEmailToken
} from "../services/email-verification.service.js";

const verifySchema = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/i)
}).strict();

export async function verifyEmail(req, res, next) {
    try {
        const parsed = verifySchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Token verifikasi tidak valid"
            });
        }

        const verified = await verifyEmailToken(parsed.data.token);

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: "Link verifikasi tidak valid atau kedaluwarsa"
            });
        }

        return res.json({
            success: true,
            message: "Email berhasil diverifikasi"
        });
    } catch (error) {
        next(error);
    }
}

export async function resendVerification(req, res, next) {
    try {
        await issueVerificationEmail(req.user.id);

        return res.json({
            success: true,
            message: "Jika email belum diverifikasi, tautan baru akan dikirim"
        });
    } catch (error) {
        next(error);
    }
}
