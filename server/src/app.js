import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

const app = express();

const normalizeOrigin = (value) => value?.replace(/\/$/, "");

// const allowedOrigins = new Set(
//   env.NODE_ENV === "development"
//     ? [normalizeOrigin(env.FRONTEND_URL), "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
//     : [normalizeOrigin(env.FRONTEND_URL)],
// );

app.use(helmet());
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       const normalizedOrigin = normalizeOrigin(origin);
//       const isLocalDevOrigin =
//         env.NODE_ENV === "development" &&
//         /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizedOrigin || "");

//       if (!origin || allowedOrigins.has(normalizedOrigin) || isLocalDevOrigin) {
//         callback(null, true);
//         return;
//       }

//       callback(new Error(`CORS origin not allowed: ${origin}`));
//     },
//     methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   }),
// );

app.set("trust proxy", 1);

const allowedOrigins = new Set([
  normalizeOrigin(env.FRONTEND_URL),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      console.warn("❌ Blocked by CORS:", origin);
      return callback(null, false); // don't crash
    },
    credentials: true,
  })
);


app.use(cookieParser());
app.use(express.json({ limit: "10mb" })); // Increased for file uploads
app.use(express.urlencoded({ limit: "10mb", extended: true })); // Support file uploads
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", environment: env.NODE_ENV });
});

app.use("/api", apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
