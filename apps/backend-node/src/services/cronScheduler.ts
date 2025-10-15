import * as cron from "node-cron";
import { logger } from "../utils/logger";
import { recurringJobService } from "./recurringJobService";

interface CronConfig {
  // Random delay window in minutes (0-15 means up to 15 minutes delay)
  randomDelayMinutes?: number;
  // Enable/disable the cron jobs
  enabled?: boolean;
}

export class CronScheduler {
  private tasks: cron.ScheduledTask[] = [];
  private config: CronConfig;

  constructor(config: CronConfig = {}) {
    this.config = {
      randomDelayMinutes: 15,
      enabled: true,
      ...config,
    };
  }

  /**
   * Initialize all cron jobs
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info("Cron scheduler is disabled");
      return;
    }

    logger.info("Starting cron scheduler...");

    // Hourly job - runs every hour at XX:00, then waits random delay
    const hourlyJobTask = cron.schedule("0 * * * *", () => {
      this.runWithRandomDelay("hourly-job", async () => {
        logger.info("Executing hourly job");
        try {
          const result = await recurringJobService.runHourlyJob({});
          logger.info("Hourly job completed successfully", { result });
        } catch (error) {
          logger.error("Hourly job failed:", error);
        }
      });
    });

    this.tasks.push(hourlyJobTask);
    // Daily job - runs every day at 2AM (02:00), then waits random delay
    const dailyJobTask = cron.schedule("0 2 * * *", () => {
      this.runWithRandomDelay("daily-job", async () => {
        logger.info("Executing daily job");
        try {
          const result = await recurringJobService.runDailyJob({
            dry_run: {
              unactivated_emails: false, // Set to false for production
              notifications: false,
            },
            send_report: true,
          });
          logger.info("Daily job completed successfully", { result });
        } catch (error) {
          logger.error("Daily job failed:", error);
        }
      });
    });

    this.tasks.push(dailyJobTask);

    logger.info(
      `Cron scheduler started with ${this.tasks.length} task(s) - random delay window: 0-${this.config.randomDelayMinutes} minutes`
    );
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    logger.info("Stopping cron scheduler...");
    this.tasks.forEach((task) => task.stop());
    this.tasks = [];
    logger.info("Cron scheduler stopped");
  }

  /**
   * Execute a function with a random delay (for more natural execution timing)
   */
  private runWithRandomDelay(jobName: string, fn: () => Promise<void>): void {
    const delayMinutes = Math.random() * (this.config.randomDelayMinutes || 15);
    const delayMs = delayMinutes * 60 * 1000;

    logger.info(
      `${jobName}: Scheduled to run in ${delayMinutes.toFixed(2)} minutes`
    );

    setTimeout(async () => {
      logger.info(`${jobName}: Starting execution now`);
      await fn();
    }, delayMs);
  }
}

// Create and export singleton instance
// Configuration can be overridden via environment variables
const cronConfig: CronConfig = {
  enabled: process.env.CRON_ENABLED !== "false", // Default enabled, can disable with CRON_ENABLED=false
  randomDelayMinutes: process.env.CRON_RANDOM_DELAY_MINUTES
    ? parseInt(process.env.CRON_RANDOM_DELAY_MINUTES, 10)
    : 15,
};

export const cronScheduler = new CronScheduler(cronConfig);
