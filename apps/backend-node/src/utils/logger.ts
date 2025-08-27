import chalk from "chalk";
import morgan from "morgan";
import { createLogger, format, transports } from "winston";
import { AuthenticatedRequest } from "../middleware/auth";

const { combine, timestamp, errors, json, printf } = format;

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
    format: consoleFormat,
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

export const morganMiddleware = morgan((tokens, req, res) => {
  const status = parseInt(tokens.status?.(req, res) ?? "0");
  const method = tokens.method?.(req, res) ?? "UNKNOWN";
  const url = tokens.url?.(req, res) ?? "";
  const responseTime = tokens["response-time"]?.(req, res);
  const userId = tokens.userId?.(req, res);

  const message = `${method} ${url} ${status} ${responseTime} ms - ${userId}`;

  if (status >= 500) {
    logger.error(colorHttp(message));
  } else if (status >= 400 && status < 500) {
    logger.warn(colorHttp(message));
  } else {
    logger.info(colorHttp(message));
  }
  return null;
});
export default logger;
