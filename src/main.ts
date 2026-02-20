import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";

dotenv.config();

import s3PrivateRoutes from "./modules/s3-private/s3-private.routes";
import s3Routes from "./modules/s3/s3.routes";
import storageRoutes from "./modules/storage/storage.routes";

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "korner-media-service" });
});

// Routes
app.use("/api/s3", s3Routes);
app.use("/api/s3-private", s3PrivateRoutes);
app.use("/api/storage", storageRoutes);

// Generic error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`korner-media-service running on port ${PORT}`);
});

export default app;
