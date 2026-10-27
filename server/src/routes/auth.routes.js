import { Router } from "express";

import {
    register,
    login,
    logout,
    me
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import {
    googleLogin
} from "../controllers/google-auth.controller.js";
import {
    authRateLimit
} from "../middleware/auth-rate-limit.middleware.js";
import {
    createCsrfToken
} from "../services/auth-session.service.js";
import {
    requireCsrf
} from "../middleware/csrf.middleware.js";
import {
    verifyEmail,
    resendVerification
} from "../controllers/email-verification.controller.js";

import { forgotPassword, resetPassword } from "../controllers/account.controller.js";

const router = Router();
router.post("/forgot-password", authRateLimit, forgotPassword);
router.post("/reset-password", authRateLimit, resetPassword);

router.post("/login", authRateLimit, login);
router.post("/register", authRateLimit, register);
router.post("/google", authRateLimit, googleLogin);
router.post("/logout", requireAuth,
    requireCsrf, logout);
router.post("/verify-email", verifyEmail);
router.post(
    "/resend-verification",
    authRateLimit,
    requireAuth,
    requireCsrf,
    resendVerification
);

router.get("/me", requireAuth, me);
router.get("/csrf-token", requireAuth, (req, res) => {
    res.set("Cache-Control", "no-store");

    return res.json({
        success: true,
        data: {
            csrfToken: createCsrfToken(
                req.authSession.id,
                req.authSession.csrfNonce
            )
        }
    });
});

export default router;
