import { NextFunction, Request, Response } from "express";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "./auth";

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

const shouldSendTelegramNotification = (req: Request, res: Response) => {
  if (res.statusCode < 500) {
    return false;
  }

  // Frontend-reported errors are already logged by /admin/public/log-error.
  // Forwarding them to Telegram creates noisy alert loops when a client query retries.
  if (req.path === "/admin/public/log-error") {
    return false;
  }

  // Root requests are usually health checks, crawlers, or misrouted frontend probes.
  if (req.path === "/" || req.originalUrl === "/") {
    return false;
  }

  return process.env.BACKEND_5XX_TELEGRAM_ENABLED !== "false";
};

export const responseMonitor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sendTelegramNotification = async () => {
    if (!shouldSendTelegramNotification(req, res)) {
      return;
    }

    try {
      const telegramService = new TelegramService();
      const authenticatedReq = req as AuthenticatedRequest;
      const userUsername = authenticatedReq.user?.username || "anonymous";
      const userId = authenticatedReq.user?.id || "unknown";

      await telegramService.sendErrorNotification({
        errorMessage: `HTTP ${res.statusCode} response on ${req.method} ${req.originalUrl || req.url}`,
        userUsername,
        userId,
      });
    } catch (telegramError) {
      logger.error("Failed to send Telegram notification:", telegramError);
    }
  };

  res.once("finish", () => {
    sendTelegramNotification();
  });

  next();
};

export const errorHandler = async (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  // Log the error
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    statusCode,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  });

  // Don't leak error details in production
  const response = {
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production" && statusCode === 500
          ? "Internal Server Error"
          : message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
};
