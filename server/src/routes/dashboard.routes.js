import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    summary,
    recentTransactions
} from "../controllers/dashboard.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", summary);
router.get("/recent-transactions", recentTransactions);

export default router;
