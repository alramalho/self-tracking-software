import { createLogger, format, transports } from "winston";

const { combine, timestamp, errors, json, colorize, cli } = format;

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: { service: "tracking-so-backend" },
  transports: [
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: combine(colorize(), cli()),
    })
  );
}

export default logger;
