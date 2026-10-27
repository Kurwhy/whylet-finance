
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
    index,
    store,
    update,
    archive
} from "../controllers/category.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", index);
router.post("/", store);
router.patch("/:id", update);
router.patch("/:id/archive", archive);

export default router;
