import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import compression from "compression";
import cors from "cors";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { errorHandler, responseMonitor } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { requestContextMiddleware } from "./middleware/requestContext";
import { logger, morganMiddleware } from "./utils/logger";
import { prisma } from "./utils/prisma";

// Import routes
import { activitiesRouter } from "./routes/activities";
import { adminRouter } from "./routes/admin";
import { aiRouter } from "./routes/ai";
import { clerkRouter } from "./routes/clerk";
import { messagesRouter } from "./routes/messages";
import { metricsRouter } from "./routes/metrics";
import { notificationsRouter } from "./routes/notifications";
import { onboardingRouter } from "./routes/onboarding";
import { plansRouter } from "./routes/plans";
import { stripeRouter } from "./routes/stripe";
import { usersRouter } from "./routes/users";

const app: Express = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ENVIRONMENT = process.env.NODE_ENV || "development";

// Rate limiting
const limiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  max: 100,
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
  "https://test-migration.tracking.so",
  "https://test-migration.tracking.so/",
];

if (ENVIRONMENT === "development") {
  allowedOrigins.push("https://alex-trackingso.loca.lt");
  allowedOrigins.push("http://localhost:3001");
  allowedOrigins.push("http://localhost:5173");
  allowedOrigins.push("http://localhost:5174");
  allowedOrigins.push("http://localhost:4173");
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
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request context middleware (must come before routes that use AI service)
app.use(requestContextMiddleware);

// Response monitoring middleware (must come before routes)
app.use(responseMonitor);

app.use(morganMiddleware);

// Apply rate limiting
app.use(limiter);

// Health check endpoint

app.get("/health", (_req, res) => {
  logger.info("Health check");
  res.json({ status: "ok" });
});

// Test exception endpoint (for testing error handling)
app.get("/exception", (_req, _res) => {
  throw new Error("Test exception");
});
app.get("/400", (_req, _res) => {
  return _res.status(400).json({ error: "Test 400" });
});

// API routes
app.use("/users", usersRouter);
app.use("/activities", activitiesRouter);
app.use("/plans", plansRouter);
app.use("/messages", messagesRouter);
app.use("/metrics", metricsRouter);
app.use("/notifications", notificationsRouter);
app.use("/onboarding", onboardingRouter);
app.use("/admin", adminRouter);
app.use("/clerk", clerkRouter);
app.use("/ai", aiRouter);
app.use("/stripe", stripeRouter);

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

if (process.env.SKIP_SERVER_START === "true") {
  logger.info("Skipping server start");
} else {
  app.listen(PORT, HOST, () => {
    logger.info(`Server running on ${HOST}:${PORT} in ${ENVIRONMENT} mode`);
    logger.info(`Health check available at http://${HOST}:${PORT}/health`);
  });
}

export default app;
