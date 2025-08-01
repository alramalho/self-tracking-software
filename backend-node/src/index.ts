import dotenv from "dotenv";
dotenv.config({ path: ".env" });


import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { prisma } from "./utils/prisma";
import { logger, morganMiddleware } from "./utils/logger";

// Import routes
import { usersRouter } from "./routes/users";
import { activitiesRouter } from "./routes/activities";
import { plansRouter } from "./routes/plans";
import { metricsRouter } from "./routes/metrics";
import { messagesRouter } from "./routes/messages";
import { notificationsRouter } from "./routes/notifications";
import { onboardingRouter } from "./routes/onboarding";
import { adminRouter } from "./routes/admin";
import { clerkRouter } from "./routes/clerk";
import { aiRouter } from "./routes/ai";
import { stripeRouter } from "./routes/stripe";

const app = express();
const PORT = process.env.PORT || 8000;
const ENVIRONMENT = process.env.NODE_ENV || "development";

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const allowedOrigins = [
  "https://tracking.so",
  "https://app.tracking.so",
  "https://app.tracking.so/",
];

if (ENVIRONMENT === "development") {
  allowedOrigins.push("http://localhost:3000");
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Raw body middleware for Stripe webhooks (must come before JSON parser)
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morganMiddleware);

// Apply rate limiting
app.use(limiter);

// Health check endpoint
app.get("/health", (_req, res) => {
  logger.info("Health check");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Test exception endpoint (for testing error handling)
app.get("/exception", (_req, _res) => {
  throw new Error("Test exception");
});

// API routes
app.use("/api/users", usersRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/plans", plansRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/clerk", clerkRouter);
app.use("/api/ai", aiRouter);
app.use("/api/stripe", stripeRouter);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${ENVIRONMENT} mode`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
});

export default app;
