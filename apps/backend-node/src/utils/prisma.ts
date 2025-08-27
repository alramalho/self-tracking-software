import { PrismaClient } from "@tsw/prisma";
import { logger } from "./logger";

type PrismaClientWithLog = PrismaClient<{
  log: Array<{
    emit: "event";
    level: "query" | "info" | "warn" | "error";
  }>;
}>;

declare global {
  var __prisma: PrismaClientWithLog | undefined;
}

export const prisma: PrismaClientWithLog =
  globalThis.__prisma ||
  new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "info",
      },
      {
        emit: "event",
        level: "warn",
      },
    ],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// Log database queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e: any) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Params: ${e.params}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

prisma.$on("error", (e: any) => {
  logger.error("Database error:", e);
});

prisma.$on("info", (e: any) => {
  logger.info("Database info:", e.message);
});

prisma.$on("warn", (e: any) => {
  logger.warn("Database warning:", e.message);
});

export default prisma;
