import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

dotenv.config();

import { internalAuthMiddleware } from "./middleware/internalAuthMiddleware";
import { logger } from "./utils/logger";
import monetizeRoutes from "./modules/monetize/monetize.routes";
import s3PrivateRoutes from "./modules/s3-private/s3-private.routes";
import s3Routes from "./modules/s3/s3.routes";
import storageRoutes from "./modules/storage/storage.routes";

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
const allowedOrigins = [
  "https://korner.pro",
  "https://korner.lol",
  "https://arsentomsky.indrive.com",
  "http://localhost:6969",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "korner-media-service" });
});

// Routes
app.use("/internal/monetize", internalAuthMiddleware, monetizeRoutes);
app.use("/api/s3", s3Routes);
app.use("/api/s3-private", s3PrivateRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/media", s3Routes);

// Generic error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
});

const server = app.listen(Number(PORT), () => {
  logger.info(`korner-media-service running on port ${PORT}`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
