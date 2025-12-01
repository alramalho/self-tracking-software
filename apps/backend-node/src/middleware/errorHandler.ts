import { NextFunction, Request, Response } from "express";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { AuthenticatedRequest } from "./auth";

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

// Routes to ignore for error notifications (common attack/probe patterns)
const IGNORED_ERROR_ROUTES = [
  // Auth probe attempts
  /\/auth\//i,
  /\/saml/i,
  /\/oauth/i,
  /\/sso/i,
  /\/login/i,
  /\/signin/i,
  /\/cas/i,
  // WordPress/CMS probes
  /\/wp-/i,
  /\/wordpress/i,
  /\/admin/i,
  /\/administrator/i,
  /\/cms/i,
  /\/joomla/i,
  /\/drupal/i,
  // Common vulnerability probes
  /\.php$/i,
  /\.asp$/i,
  /\.aspx$/i,
  /\.jsp$/i,
  /\.env/i,
  /\.git/i,
  /\.aws/i,
  /\/config/i,
  /\/backup/i,
  /\/debug/i,
  /\/phpinfo/i,
  /\/phpmyadmin/i,
  /\/mysql/i,
  /\/actuator/i,
  /\/swagger/i,
  /\/graphql/i,
  /\/api-docs/i,
  // Bot/scanner patterns
  /\/robots\.txt/i,
  /\/sitemap/i,
  /\/favicon/i,
  /\/well-known/i,
];

const shouldIgnoreErrorNotification = (url: string, statusCode: number): boolean => {
  // Only filter 404s for probe routes (real errors should still notify)
  if (statusCode !== 404) return false;

  return IGNORED_ERROR_ROUTES.some(pattern => pattern.test(url));
};

export const responseMonitor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalSend = res.send;
  const originalJson = res.json;

  const sendTelegramNotification = async () => {
    if (res.statusCode >= 400 && res.statusCode != 401) {
      // Skip notifications for common probe/attack routes
      if (shouldIgnoreErrorNotification(req.url, res.statusCode)) {
        return;
      }

      try {
        const telegramService = new TelegramService();
        const authenticatedReq = req as AuthenticatedRequest;
        const userUsername = authenticatedReq.user?.username || "anonymous";
        const userId = authenticatedReq.user?.id || "unknown";

        await telegramService.sendErrorNotification({
          errorMessage: `HTTP ${res.statusCode} response on ${req.method} ${req.url}`,
          userUsername,
          userId,
        });
      } catch (telegramError) {
        logger.error("Failed to send Telegram notification:", telegramError);
      }
    }
  };

  res.send = function (body) {
    sendTelegramNotification();
    return originalSend.call(this, body);
  };

  res.json = function (body) {
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
