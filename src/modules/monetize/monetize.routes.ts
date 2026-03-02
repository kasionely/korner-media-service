import { Router } from "express";

import * as monetizeController from "./monetize.controller";

const router = Router();

router.post("/", monetizeController.monetize);

export default router;
