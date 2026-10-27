import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

import {
    show,
    update,
    toggle
} from "../controllers/spending-limit.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", show);
router.put("/", update);
router.patch("/toggle", toggle);

export default router;
