import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { parseText } from "../controllers/smart-input.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/parse", parseText);

export default router;
