import cors from "cors";
import express, { Router } from "express";
import multer from "multer";

import * as s3Controller from "./s3.controller";

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

const upload = multer({ storage: multer.memoryStorage() });

router.options("*", cors(corsOptions));

router.post("/upload/image", cors(corsOptions), upload.single("image"), s3Controller.uploadImage);
router.post("/upload/audio", cors(corsOptions), upload.single("audio"), s3Controller.uploadAudio);
router.post("/upload/video", cors(corsOptions), upload.single("video"), s3Controller.uploadVideo);
router.post("/upload/file", cors(corsOptions), upload.single("file"), s3Controller.uploadFile);
router.get("/:key", s3Controller.getFile);
router.get("/:username/:filename", s3Controller.getFileByPath);
router.delete("/delete", cors(corsOptions), express.json({ limit: "50mb" }), s3Controller.deleteFile);

export default router;
