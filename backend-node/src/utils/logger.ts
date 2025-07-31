import { createLogger, format, transports } from "winston";
import chalk from "chalk";
import morgan from "morgan";

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
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: consoleFormat,
    })
  );
}

function colorHttp(message: string): string {
  const parts = message.split(" ");
  const method = parts[1];
  const status = parts[3];

  const methodColors: Record<string, any> = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    DELETE: chalk.red,
    PATCH: chalk.magenta,
  };

  const coloredMethod = (methodColors[method] || chalk.cyan)(method);
  const statusCode = parseInt(status);
  const coloredStatus =
    statusCode >= 500
      ? chalk.red(status)
      : statusCode >= 400
        ? chalk.yellow(status)
        : statusCode >= 300
          ? chalk.cyan(status)
          : statusCode >= 200
            ? chalk.green(status)
            : status;

  return message.replace(method, coloredMethod).replace(status, coloredStatus);
}

export const morganMiddleware = morgan(
  ":remote-addr :method :url :status :res[content-length] - :response-time ms",
  {
    stream: {
      write: (message: string) => logger.info(colorHttp(message)),
    },
  }
);
export default logger;
