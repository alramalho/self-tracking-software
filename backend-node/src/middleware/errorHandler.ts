import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { TelegramService } from "../services/telegramService";
import { AuthenticatedRequest } from "./auth";

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

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

  // Send error notification to Telegram for non-401/404/405 errors
  if (
    statusCode >= 500 ||
    (statusCode >= 400 &&
      statusCode !== 401 &&
      statusCode !== 404 &&
      statusCode !== 405)
  ) {
    try {
      const telegramService = new TelegramService();
      // Extract user context from authenticated request if available
      const authenticatedReq = req as AuthenticatedRequest;
      const userUsername = authenticatedReq.user?.username || "anonymous";
      const userId = authenticatedReq.user?.id || "unknown";

      await telegramService.sendErrorNotification({
        errorMessage: error.message,
        userUsername,
        userId,
        path: req.url,
        method: req.method,
        statusCode: statusCode.toString(),
      });
    } catch (telegramError) {
      logger.error("Failed to send Telegram notification:", telegramError);
    }
  }

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
