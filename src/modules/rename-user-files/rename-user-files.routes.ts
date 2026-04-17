import { Router } from "express";

import * as renameUserFilesController from "./rename-user-files.controller";

const router = Router();

router.post("/", renameUserFilesController.renameUserFiles);

export default router;
