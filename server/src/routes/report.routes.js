import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
    monthly,
    categories,
    exportCsv
} from "../controllers/report.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/monthly", monthly);
router.get("/categories", categories);
router.get("/export", exportCsv);

export default router;
