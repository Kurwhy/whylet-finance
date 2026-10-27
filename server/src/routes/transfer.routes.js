import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
    index,
    show,
    store
} from "../controllers/transfer.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", index);
router.post("/", store);
router.get("/:id", show);

export default router;
