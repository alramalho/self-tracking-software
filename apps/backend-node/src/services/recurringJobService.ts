import { TZDate } from "@date-fns/tz";
import { JobType, User } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { plansService } from "./plansService";
import { sesService } from "./sesService";
import { userService } from "./userService";

interface DailyJobOptions {
  filter_usernames?: string[];
  dry_run?: {
    unactivated_emails?: boolean;
    notifications?: boolean;
  };
  send_report?: boolean;
}

interface DailyJobResult {
  dry_run: {
    unactivated_emails: boolean;
  };
  users_checked: number;
  recommendations_outdated: string[];
  unactivated_emails_result: {
    message?: string;
    would_email?: number;
    would_email_usernames?: string[];
    emails_sent?: number;
    emailed_usernames?: string[];
    unactivated_users_count?: number;
  };
}

interface HourlyJobOptions {
  filter_usernames?: string[];
  force?: boolean; // If true, bypass 8am timezone check
}

interface HourlyJobResult {
  message: string;
  started_for_users: string[];
  total_users_checked: number;
}

export class RecurringJobService {
  /**
   * Check if it's currently 8am in the user's timezone
   */
  private isUserTimezoneHour(user: User, hour: number): boolean {
    try {
      const timezone = user.timezone || "UTC";
      const now = new Date();
      const userTime = new TZDate(now, timezone);
      const userHour = userTime.getHours();

      return userHour === hour;
    } catch (error) {
      logger.error(`Error checking timezone for user ${user.username}:`, error);
      return false;
    }
  }

  /**
   * Track and execute a job with automatic logging to the database
   */
  private async trackJobExecution<T>(
    jobType: JobType,
    input: any,
    triggeredBy: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Create job run record
    const jobRun = await prisma.jobRun.create({
      data: {
        jobType,
        input: input || {},
        triggeredBy,
        startedAt: new Date(),
      },
    });

    try {
      // Execute the job
      const result = await fn();

      // Update with success
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          completedAt: new Date(),
          success: true,
          output: result as any,
        },
      });

      return result;
    } catch (error) {
      // Update with failure
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          completedAt: new Date(),
          success: false,
          errorMessage,
          errorStack,
        },
      });

      throw error;
    }
  }

  /**
   * Main daily job execution logic
   */
  async runDailyJob(
    options: DailyJobOptions = {},
    triggeredBy: string = "CRON"
  ): Promise<DailyJobResult> {
    return this.trackJobExecution("DAILY", options, triggeredBy, async () => {
      return this.executeDailyJob(options);
    });
  }

  /**
   * Internal daily job execution (without tracking)
   */
  private async executeDailyJob(
    options: DailyJobOptions = {}
  ): Promise<DailyJobResult> {
    const {
      filter_usernames = [],
      dry_run = { unactivated_emails: true, notifications: true },
      send_report = false,
    } = options;

    const unactivatedEmailsDryRun = dry_run.unactivated_emails !== false;

    logger.info(
      `Running daily job with filter_usernames: ${filter_usernames} and unactivated_emails_dry_run: ${unactivatedEmailsDryRun}`
    );

    // Get all users or subset if specified
    let allUsers = await userService.getAllUsers();

    if (filter_usernames.length > 0) {
      allUsers = allUsers.filter(
        (user) => user.username && filter_usernames.includes(user.username)
      );
    }

    // Process unactivated emails
    const unactivatedEmailsResult = await this.processUnactivatedEmails(
      allUsers,
      unactivatedEmailsDryRun
    );

    // TODO: Process recommendations outdated logic when recommendations system is ready
    const recommendationsOutdatedResult: string[] = [];

    const result: DailyJobResult = {
      dry_run: {
        unactivated_emails: unactivatedEmailsDryRun,
      },
      users_checked: allUsers.length,
      recommendations_outdated: recommendationsOutdatedResult,
      unactivated_emails_result: unactivatedEmailsResult,
    };

    // Send report email if requested
    if (send_report) {
      await this.sendDailyJobReport(result);
    }

    return result;
  }

  /**
   * Main hourly job execution logic (for plan coaching)
   */
  async runHourlyJob(
    options: HourlyJobOptions = {},
    triggeredBy: string = "CRON"
  ): Promise<HourlyJobResult> {
    return this.trackJobExecution("HOURLY", options, triggeredBy, async () => {
      return this.executeHourlyJob(options);
    });
  }

  /**
   * Internal hourly job execution (without tracking)
   */
  private async executeHourlyJob(
    options: HourlyJobOptions = {}
  ): Promise<HourlyJobResult> {
    const { filter_usernames = [], force = false } = options;

    logger.info(
      `Starting hourly job execution for plan coaching${force ? " (FORCED - ignoring timezone check)" : ""}`
    );

    // Get paid users with plans
    let users = await prisma.user.findMany({
      where: {
        planType: "PLUS",
        deletedAt: null,
      },
      include: {
        plans: {
          where: {
            deletedAt: null,
          },
          include: {
            activities: true,
          },
        },
      },
    });

    if (filter_usernames.length > 0) {
      logger.info(
        `Filtering users by usernames: ${filter_usernames.join(", ")}`
      );
      const beforeCount = users.length;
      users = users.filter(
        (user) => user.username && filter_usernames.includes(user.username)
      );
      logger.info(
        `Filtered from ${beforeCount} users to ${users.length} users`
      );
    }

    // Filter users who have plans and it's 8am in their timezone (or force is true)
    const usersToCoach = users.filter((user) => {
      if (!user.plans || user.plans.length === 0) {
        return false;
      }
      // If force is true, bypass timezone check
      if (force) {
        return true;
      }
      return this.isUserTimezoneHour(user, 8);
    });

    logger.info(
      force
        ? `Processing ${usersToCoach.length} users (FORCED mode)`
        : `Found ${usersToCoach.length} users where it's 8am (out of ${users.length} paid users)`
    );

    let coachingSuccesses = 0;
    let coachingFailures = 0;
    const startedForUsers: string[] = [];

    // Process plan coaching for each eligible user
    // Process their coached plan, or fallback to newest plan
    for (const user of usersToCoach) {
      try {
        // Get the user's coached plan, or the newest plan as fallback
        const coachedPlan = (user.plans as any[]).find((p: any) => p.isCoached);
        const firstPlan = coachedPlan || user.plans.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        })[0];

        if (!firstPlan) {
          logger.warn(`User ${user.username} has no plans to coach`);
          continue;
        }

        logger.info(
          `Processing plan coaching for user ${user.username} on plan '${firstPlan.goal}'`
        );

        // Process coaching (this will check activity, recalculate state, and send notification if needed)
        const notification = await plansService.processPlanCoaching(
          user,
          firstPlan,
          true // pushNotify
        );

        if (notification) {
          coachingSuccesses++;
          startedForUsers.push(user.username || "unknown");
          logger.info(
            `Successfully sent coaching notification to ${user.username}`
          );
        } else {
          logger.info(
            `No coaching notification needed for ${user.username} (no state change or inactive)`
          );
        }
      } catch (error) {
        coachingFailures++;
        logger.error(
          `Failed to process coaching for user ${user.username}:`,
          error
        );
        // Continue with other users even if one fails
      }
    }

    logger.info(
      `Hourly coaching job completed: ${coachingSuccesses} notifications sent, ${coachingFailures} failures, ${users.length} total users checked`
    );

    return {
      message: `Processed coaching for ${usersToCoach.length} users (${coachingSuccesses} notifications sent, ${coachingFailures} failures)`,
      started_for_users: startedForUsers,
      total_users_checked: users.length,
    };
  }

  /**
   * Process unactivated emails - identifies users who signed up but haven't used the app
   */
  private async processUnactivatedEmails(
    users: User[],
    dryRun: boolean = true
  ) {
    const unactivatedUsers: User[] = [];

    for (const user of users) {
      const userActivities = await prisma.activityEntry.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      });

      const activityDays = new Set(
        userActivities.map(
          (entry) => entry.createdAt.toISOString().split("T")[0]
        )
      );

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      if (user.createdAt < weekAgo && activityDays.size <= 1) {
        unactivatedUsers.push(user);
      }
    }

    if (dryRun) {
      return {
        message: "Email sending skipped (dry run)",
        would_email: unactivatedUsers.length,
        would_email_usernames: unactivatedUsers.map((u: any) => u.username),
      };
    }

    const triggeredUserUsernames: string[] = [];
    for (const user of unactivatedUsers) {
      if (user.unactivatedEmailSentAt) {
        logger.info(
          `Unactivated email already sent to '${user.username}', skipping`
        );
        continue;
      }

      // TODO: Implement loops email service
      logger.info(`Would send unactivated email to ${user.email}`);

      await prisma.user.update({
        where: { id: user.id },
        data: { unactivatedEmailSentAt: new Date() },
      });

      if (user.username) {
        triggeredUserUsernames.push(user.username);
      }
    }

    return {
      emails_sent: triggeredUserUsernames.length,
      emailed_usernames: triggeredUserUsernames,
      unactivated_users_count: unactivatedUsers.length,
    };
  }

  /**
   * Send daily job report via email
   */
  private async sendDailyJobReport(result: DailyJobResult): Promise<void> {
    const currentDate = new Date().toISOString().split("T")[0];
    const environment = process.env.NODE_ENV || "development";
    const reportEmail = process.env.ADMIN_EMAIL || "admin@tracking.so";

    await sesService.sendEmail({
      to: reportEmail,
      subject: `Daily Job for Tracking.so [${environment}] [${currentDate}]`,
      htmlBody: `<strong>Daily Job Report in ${environment} environment</strong><br><br><pre>${JSON.stringify(result, null, 2)}</pre>`,
    });
  }
}

export const recurringJobService = new RecurringJobService();
