import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
    index,
    show,
    store,
    update,
    destroy
} from "../controllers/transaction.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", index);
router.post("/", store);
router.get("/:id", show);
router.patch("/:id", update);
router.delete("/:id", destroy);

export default router;
