interface LogEvent {
  level: string;
  message: string;
  extra?: Record<string, any>;
}

interface UserInfo {
  email?: string | null;
  username?: string | null;
}

class Logger {
  private static instance: Logger;
  private batch: LogEvent[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 seconds
  private timer: NodeJS.Timeout | null = null;
  private authToken: string | null = null;
  private userInfo: UserInfo | null = null;

  private constructor() {
    this.setupFlushInterval();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  public setUserInfo(info: UserInfo | null) {
    this.userInfo = info;
  }

  private setupFlushInterval() {
    if (typeof window !== "undefined") {
      this.timer = setInterval(() => this.flush(), this.flushInterval);
    }
  }

  private stringifyArg(arg: any): string {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean")
      return arg.toString();
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
    }
    try {
      return JSON.stringify(
        arg,
        (key, value) => {
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack,
            };
          }
          return value;
        },
        2
      );
    } catch (e) {
      return "[Circular or Invalid Object]";
    }
  }

  private async flush() {
    if (this.batch.length === 0) return;

    const batchToSend = [...this.batch];
    this.batch = [];

    try {
      for (const event of batchToSend) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.authToken) {
          headers["Authorization"] = `Bearer ${this.authToken}`;
        }

        if (
          process.env.NEXT_PUBLIC_ENVIRONMENT?.toLowerCase().includes(
            "development"
          )
        ) {
          return;
        }

        await fetch("/api/log", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...event,
            time: new Date().toISOString(),
            service: "tracking-so-frontend",
            ...(this.userInfo && {
              email: this.userInfo.email,
              username: this.userInfo.username,
            }),
          }),
        });
      }
    } catch (error) {
      console.error("Failed to send logs to server:", error);
      // Add back to batch if failed
      this.batch = [...batchToSend, ...this.batch].slice(-this.batchSize);
    }
  }

  private addToBatch(event: LogEvent) {
    this.batch.push(event);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  public log(level: string, message: string, extra?: Record<string, any>) {
    this.addToBatch({
      level,
      message: this.stringifyArg(message),
      extra: extra ? JSON.parse(this.stringifyArg(extra)) : undefined,
    });
  }

  public info(message: string, extra?: Record<string, any>) {
    this.log("info", message, extra);
  }

  public warn(message: string, extra?: Record<string, any>) {
    this.log("warn", message, extra);
  }

  public error(message: string, extra?: Record<string, any>) {
    this.log("error", message, extra);
  }

  public debug(message: string, extra?: Record<string, any>) {
    this.log("debug", message, extra);
  }
}

// Create and export the logger instance
export const logger = Logger.getInstance();

if (typeof window !== "undefined") {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  console.log = (...args: any[]) => {
    const stringifiedArgs = args.map((arg) => logger["stringifyArg"](arg));
    logger.info(stringifiedArgs.join(" "));
    originalConsole.log(...args);
  };

  console.info = (...args: any[]) => {
    const stringifiedArgs = args.map((arg) => logger["stringifyArg"](arg));
    logger.info(stringifiedArgs.join(" "));
    originalConsole.info(...args);
  };

  console.warn = (...args: any[]) => {
    const stringifiedArgs = args.map((arg) => logger["stringifyArg"](arg));
    logger.warn(stringifiedArgs.join(" "));
    originalConsole.warn(...args);
  };

  console.error = (...args: any[]) => {
    const stringifiedArgs = args.map((arg) => logger["stringifyArg"](arg));
    logger.error(stringifiedArgs.join(" "));
    originalConsole.error(...args);
  };

  console.debug = (...args: any[]) => {
    const stringifiedArgs = args.map((arg) => logger["stringifyArg"](arg));
    logger.debug(stringifiedArgs.join(" "));
    originalConsole.debug(...args);
  };
}

// Export patched console for explicit usage
export const log = logger;
