
import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

import {
    index,
    show,
    store,
    update,
    setDefault,
    archive,
    unarchive
} from "../controllers/wallet.controller.js";

const router = Router();

// Semua endpoint membutuhkan login.
router.use(requireAuth);

router.get("/", index);
router.post("/", store);
router.get("/:id", show);
router.patch("/:id", update);
router.patch("/:id/default", setDefault);
router.patch("/:id/archive", archive);
router.patch("/:id/unarchive", unarchive);

export default router;
