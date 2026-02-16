import { Router } from "express";

import * as storageController from "./storage.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const router = Router();

router.get("/usage", authMiddleware, storageController.getUsage);
router.get("/list", authMiddleware, storageController.listFiles);

export default router;
