import { NextFunction, Request, Response } from "express";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "./auth";

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export const responseMonitor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalSend = res.send;
  const originalJson = res.json;

  const sendTelegramNotification = async () => {
    if (res.statusCode >= 400) {
      try {
        const telegramService = new TelegramService();
        const authenticatedReq = req as AuthenticatedRequest;
        const userUsername = authenticatedReq.user?.username || "anonymous";
        const userId = authenticatedReq.user?.id || "unknown";

        await telegramService.sendErrorNotification({
          errorMessage: `HTTP ${res.statusCode} response on ${req.url}`,
          userUsername,
          userId,
          path: req.url,
          method: req.method,
          statusCode: res.statusCode.toString(),
        });
      } catch (telegramError) {
        logger.error("Failed to send Telegram notification:", telegramError);
      }
    }
  };

  res.send = function (body) {
    console.log("sending body", body);
    sendTelegramNotification();
    return originalSend.call(this, body);
  };

  res.json = function (body) {
    console.log("sending json", body);
    sendTelegramNotification();
    return originalJson.call(this, body);
  };

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
