import chalk from "chalk";
import morgan from "morgan";
import { createLogger, format, transports } from "winston";
import { AuthenticatedRequest } from "../middleware/auth";

const { combine, timestamp, errors, json, printf } = format;
const isProduction = process.env.NODE_ENV === "production";

type LoggableError = {
  name?: string;
  message: string;
  stack?: string;
  statusCode?: unknown;
  status?: unknown;
  code?: unknown;
  type?: unknown;
  url?: unknown;
  requestId?: unknown;
  generationId?: unknown;
  gateway?: unknown;
  cause?: LoggableError;
};

function truncateLogString(value: string, maxLength = 2500): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 15)}... [truncated]`
    : value;
}

function parseJsonObject(value: unknown): Record<string, any> | undefined {
  if (typeof value !== "string") return undefined;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function getNestedObject(value: unknown, path: string[]): Record<string, any> | undefined {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, any>
    : undefined;
}

function compactGatewayMetadata(error: any): unknown {
  const parsedResponseBody = parseJsonObject(error?.responseBody);
  const gateway =
    getNestedObject(error, ["providerMetadata", "gateway"]) ||
    getNestedObject(error, ["data", "providerMetadata", "gateway"]) ||
    getNestedObject(parsedResponseBody, ["providerMetadata", "gateway"]);

  if (!gateway) return undefined;

  const routing = gateway.routing;
  return {
    generationId: gateway.generationId,
    cost: gateway.cost,
    marketCost: gateway.marketCost,
    routing: routing && typeof routing === "object"
      ? {
          originalModelId: routing.originalModelId,
          canonicalSlug: routing.canonicalSlug,
          resolvedProvider: routing.resolvedProvider,
          finalProvider: routing.finalProvider,
          fallbacksAvailable: routing.fallbacksAvailable,
          modelAttemptCount: routing.modelAttemptCount,
          totalProviderAttemptCount: routing.totalProviderAttemptCount,
          providerAttemptCount: routing.providerAttemptCount,
        }
      : undefined,
  };
}

export function serializeErrorForLog(error: unknown): LoggableError {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const err = error as any;
  const parsedResponseBody = parseJsonObject(err.responseBody);
  const parsedError = getNestedObject(parsedResponseBody, ["error"]);
  const gateway = compactGatewayMetadata(err);
  const generationId =
    gateway && typeof gateway === "object"
      ? (gateway as Record<string, unknown>).generationId
      : undefined;
  const cause =
    err.cause && err.cause !== error
      ? serializeErrorForLog(err.cause)
      : undefined;

  return {
    name: typeof err.name === "string" ? err.name : undefined,
    message:
      typeof err.message === "string"
        ? err.message
        : typeof parsedError?.message === "string"
          ? parsedError.message
          : String(error),
    stack: typeof err.stack === "string" ? truncateLogString(err.stack) : undefined,
    statusCode: err.statusCode ?? err.status ?? parsedError?.statusCode,
    status: err.status,
    code: err.code ?? parsedError?.code,
    type: err.type ?? parsedError?.type,
    url: err.url,
    requestId: err.requestId,
    generationId,
    gateway,
    cause,
  };
}

const consoleFormat = printf(
  ({ level, message, timestamp, stack, ...meta }) => {
    let color = chalk.white;

    if (level.includes("error")) color = chalk.red;
    else if (level.includes("warn")) color = chalk.yellow;
    else if (level.includes("info")) color = chalk.blue;
    else if (level.includes("debug")) color = chalk.gray;

    // Handle case where message is an object
    let displayMessage = message;
    if (typeof message === "object" && message !== null) {
      displayMessage = JSON.stringify(message, null, 2);
    }

    let formattedMessage = `${chalk.gray(timestamp)} ${color(level)}: ${displayMessage}`;

    // Add stack trace for errors
    if (stack) {
      formattedMessage += `\n${chalk.red(stack)}`;
    }

    // Add metadata if present (excluding winston's internal fields)
    const filteredMeta = Object.keys(meta)
      .filter((key) => !["service"].includes(key))
      .reduce((obj, key) => {
        obj[key] = meta[key];
        return obj;
      }, {} as any);

    if (Object.keys(filteredMeta).length > 0) {
      formattedMessage += `\n${chalk.gray(JSON.stringify(filteredMeta, null, 2))}`;
    }

    return formattedMessage;
  }
);

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(errors({ stack: true }), timestamp()),
  defaultMeta: { service: "tracking-so-backend" },
  transports: [
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(json()),
    }),
    new transports.File({
      filename: "logs/combined.log",
      format: combine(json()),
    }),
  ],
});

// If we're not in production, log to the console with custom format
// if (process.env.NODE_ENV !== "production") {
logger.add(
  new transports.Console({
    format: isProduction ? combine(timestamp(), json()) : consoleFormat,
  })
);
// }

function colorHttp(message: string): string {
  const parts = message.split(" ");
  const method = parts[0];
  const url = parts[1];
  const status = parts[2];
  const remaining = parts.slice(3).join(" ");

  const methodColors: Record<string, any> = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    DELETE: chalk.red,
    PATCH: chalk.magenta,
  };

  const coloredMethod = (methodColors[method] || chalk.cyan)(method);
  const coloredUrl = chalk.gray(url);
  const coloredRemaining = chalk.gray(remaining);
  const statusCode = parseInt(status);
  const coloredStatus =
    statusCode >= 500 || statusCode == 0
      ? chalk.red(status)
      : statusCode >= 400
        ? chalk.yellow(status)
        : statusCode >= 300
          ? chalk.cyan(status)
          : statusCode >= 200
            ? chalk.green(status)
            : status;

  return message
    .replace(method, coloredMethod)
    .replace(url, coloredUrl)
    .replace(status, coloredStatus)
    .replace(remaining, coloredRemaining);
}

morgan.token("userId", function (req: AuthenticatedRequest) {
  return req.user ? req.user.id : "anonymous";
});

morgan.token("ip", function (req: any) {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
});

export const morganMiddleware = morgan((tokens, req, res) => {
  const status = parseInt(tokens.status?.(req, res) ?? "0");
  const method = tokens.method?.(req, res) ?? "UNKNOWN";
  const url = tokens.url?.(req, res) ?? "";
  const responseTime = Number(tokens["response-time"]?.(req, res) ?? 0);
  const userId = tokens.userId?.(req, res);
  const ip = tokens.ip?.(req, res);

  const message = `(IP: ${ip}) ${method} ${url} ${status} ${responseTime} ms - ${userId}`;
  const metadata = {
    event: "http_request",
    ip,
    method,
    url,
    status,
    responseTimeMs: responseTime,
    userId,
  };

  if (status >= 500) {
    logger.error(isProduction ? "handled request" : colorHttp(message), metadata);
  } else if (status >= 400 && status < 500) {
    logger.warn(isProduction ? "handled request" : colorHttp(message), metadata);
  } else {
    logger.info(isProduction ? "handled request" : colorHttp(message), metadata);
  }
  return null;
});
export default logger;
