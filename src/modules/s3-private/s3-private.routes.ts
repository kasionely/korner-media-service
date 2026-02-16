import cors from "cors";
import { Router } from "express";

import * as s3PrivateController from "./s3-private.controller";
import {
  authenticateUser,
  checkContentAccess,
  requireSubscription,
} from "../../middleware/subscription.middleware";

const router = Router();

const allowedOrigins = ["https://korner.pro", "https://korner.lol", "http://localhost:6969"];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

router.options("*", cors(corsOptions));

router.post("/upload/private/presigned-url", cors(corsOptions), authenticateUser, requireSubscription, s3PrivateController.generateUploadPresignedUrl);
router.post("/access/presigned-url", cors(corsOptions), authenticateUser, checkContentAccess, s3PrivateController.generateAccessPresignedUrl);
router.get("/metadata/:key(*)", cors(corsOptions), authenticateUser, checkContentAccess, s3PrivateController.getFileMetadata);
router.delete("/delete", cors(corsOptions), authenticateUser, s3PrivateController.deletePrivateFile);

export default router;
