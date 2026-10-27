
import { z } from "zod";

import {
    authenticateWithGoogle
} from "../services/google-auth.service.js";

import {
    createAuthSession
} from "../services/auth-session.service.js";

const schema = z.object({
    credential: z.string().min(100).max(10000)
}).strict();

export async function googleLogin(req, res, next) {
    try {
        const parsed = schema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Google credential tidak valid"
            });
        }

        // 1. Verifikasi identitas Google
        const user = await authenticateWithGoogle(
            parsed.data.credential
        );

        // 2. Buat sesi Whylet yang tercatat di MySQL
        await createAuthSession(user.id, res);

        // 3. Kirim profil pengguna tanpa data sensitif
        return res.json({
            success: true,
            message: "Login Google berhasil",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    emailVerifiedAt: user.emailVerifiedAt
                }
            }
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                message: error.message
            });
        }

        next(error);
    }
}
