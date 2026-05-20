import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, setHours, setMinutes } from "date-fns";
import { JobType, User, Reminder } from "@tsw/prisma";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { notificationService } from "./notificationService";
import { sesService } from "./sesService";
import { userService } from "./userService";
import { runCategorizationJob } from "./planCategorizationService";
import { coachAssessmentService } from "./coachAssessmentService";

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
  plan_categorization_result?: {
    categorized: number;
    errors: number;
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
  reminders_processed: number;
  reminders_sent: string[];
  activity_reminders_checked: number;
  activity_reminders_sent: string[];
  batched_notifications_sent: string[];
  autonomous_coach_checked: number;
  autonomous_coach_sent: number;
}

export class RecurringJobService {
  /**
   * Check if it's currently within the user's preferred 2-hour coaching interval
   * @param user - User with preferredCoachingHour (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
   * @returns true if current hour is within the 2-hour interval
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

    // Categorize plans with changed goals
    let planCategorizationResult: { categorized: number; errors: number } | undefined;
    try {
      planCategorizationResult = await runCategorizationJob();
    } catch (err) {
      logger.error("Plan categorization job failed:", err);
    }

    const result: DailyJobResult = {
      dry_run: {
        unactivated_emails: unactivatedEmailsDryRun,
      },
      users_checked: allUsers.length,
      recommendations_outdated: recommendationsOutdatedResult,
      unactivated_emails_result: unactivatedEmailsResult,
      plan_categorization_result: planCategorizationResult,
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
   * Note: Old plan coaching notifications have been disabled in favor of the new AI reminders system
   */
  private async executeHourlyJob(
    options: HourlyJobOptions = {}
  ): Promise<HourlyJobResult> {
    logger.info("Starting hourly job execution");

    // Process due reminders
    const reminderResults = await this.processDueReminders();

    // Process batched social notifications
    const batchedNotificationResults = await this.processBatchedNotifications();

    // Process autonomous coach assessments. This is feature-flagged and dry-run
    // by default so production rollout can be staged without changing cron.
    const coachAssessmentResults =
      await coachAssessmentService.runAutonomousCoachAssessment({
        filter_usernames: options.filter_usernames,
        force: options.force,
      });

    // Auto-accept coach proposals that have been pending for 48+ hours
    const autoAcceptResults = await coachAssessmentService.autoAcceptExpiredProposals();
    if (autoAcceptResults.accepted > 0) {
      logger.info(`Auto-accepted ${autoAcceptResults.accepted} expired coach proposals`);
    }

    logger.info(
      `Hourly job completed: ${reminderResults.processed} reminders processed, ${reminderResults.sent.length} sent, ${batchedNotificationResults.sent.length} batched notifications sent, ${coachAssessmentResults.messages_sent} autonomous coach messages sent`
    );

    return {
      message: `Processed ${reminderResults.processed} reminders (${reminderResults.sent.length} sent), ${batchedNotificationResults.sent.length} batched notifications sent.`,
      started_for_users: [],
      total_users_checked: 0,
      reminders_processed: reminderResults.processed,
      reminders_sent: reminderResults.sent,
      activity_reminders_checked: 0,
      activity_reminders_sent: [],
      batched_notifications_sent: batchedNotificationResults.sent,
      autonomous_coach_checked: coachAssessmentResults.users_checked,
      autonomous_coach_sent: coachAssessmentResults.messages_sent,
    };
  }

  /**
   * Process reminders that are due to trigger
   */
  private async processDueReminders(): Promise<{
    processed: number;
    sent: string[];
  }> {
    const now = new Date();
    const sent: string[] = [];

    try {
      // Find all reminders that are due (triggerAt <= now and status = PENDING)
      const dueReminders = await prisma.reminder.findMany({
        where: {
          status: "PENDING",
          triggerAt: {
            lte: now,
          },
        },
        include: {
          user: true,
        },
      });

      logger.info(`Found ${dueReminders.length} due reminders to process`);

      for (const reminder of dueReminders) {
        try {
          // Send notification to the user
          await notificationService.createAndProcessNotification({
            userId: reminder.userId,
            title: "Reminder",
            message: reminder.message,
            type: "COACH",
            relatedId: reminder.id,
            relatedData: {
              reminderId: reminder.id,
              isRecurring: reminder.isRecurring,
            },
          });

          sent.push(reminder.message);
          logger.info(
            `Sent reminder "${reminder.message}" to user ${reminder.user.username}`
          );

          if (reminder.isRecurring) {
            // Calculate next trigger time
            const nextTriggerAt = this.calculateNextReminderTrigger(reminder);

            if (nextTriggerAt) {
              await prisma.reminder.update({
                where: { id: reminder.id },
                data: {
                  triggerAt: nextTriggerAt,
                  lastTriggeredAt: now,
                },
              });
              logger.info(
                `Scheduled next occurrence of recurring reminder ${reminder.id} for ${nextTriggerAt}`
              );
            }
          } else {
            // Mark one-time reminder as completed
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: {
                status: "COMPLETED",
                lastTriggeredAt: now,
              },
            });
          }
        } catch (error) {
          logger.error(
            `Failed to process reminder ${reminder.id}:`,
            error
          );
          // Continue with other reminders
        }
      }

      return {
        processed: dueReminders.length,
        sent,
      };
    } catch (error) {
      logger.error("Error processing due reminders:", error);
      return {
        processed: 0,
        sent: [],
      };
    }
  }

  /**
   * Calculate the next trigger time for a recurring reminder
   */
  private calculateNextReminderTrigger(reminder: Reminder): Date | null {
    const currentTrigger = new Date(reminder.triggerAt);
    const hours = currentTrigger.getHours();
    const minutes = currentTrigger.getMinutes();

    switch (reminder.recurringType) {
      case "DAILY":
        // Next day at the same time
        return addDays(currentTrigger, 1);

      case "WEEKLY": {
        // Find the next occurrence based on recurringDays
        if (!reminder.recurringDays || reminder.recurringDays.length === 0) {
          // Default to same day next week
          return addDays(currentTrigger, 7);
        }

        const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        const currentDayIndex = currentTrigger.getDay();

        // Find the next valid day
        for (let i = 1; i <= 7; i++) {
          const nextDayIndex = (currentDayIndex + i) % 7;
          const nextDayName = dayNames[nextDayIndex];
          if (reminder.recurringDays.includes(nextDayName)) {
            const nextDate = addDays(currentTrigger, i);
            return setMinutes(setHours(nextDate, hours), minutes);
          }
        }

        // Fallback to same day next week
        return addDays(currentTrigger, 7);
      }

      case "MONTHLY":
        // Same day next month
        return addMonths(currentTrigger, 1);

      default:
        return null;
    }
  }

  private async processBatchedNotifications(): Promise<{
    sent: string[];
  }> {
    const sent: string[] = [];

    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Find unsent notifications from the last 24h, filter for batchCategory in code
      const allUnsent = await prisma.notification.findMany({
        where: {
          status: "PROCESSED",
          sentAt: null,
          createdAt: { gte: twentyFourHoursAgo },
        },
        include: { user: true },
      });

      const unbatchedNotifications = allUnsent.filter(
        (n) => (n.relatedData as any)?.batchCategory
      );

      if (unbatchedNotifications.length === 0) return { sent: [] };

      // Group by user
      const byUser = new Map<string, typeof unbatchedNotifications>();
      for (const n of unbatchedNotifications) {
        const list = byUser.get(n.userId) || [];
        list.push(n);
        byUser.set(n.userId, list);
      }

      const categoryLabels: Record<string, (count: number) => string> = {
        REACTIONS: (c) => `you got ${c} reaction${c > 1 ? "s" : ""} on your activities`,
        FRIEND_POSTS: (c) => `${c} friend${c > 1 ? "s" : ""} shared achievements`,
        COMMENTS: (c) => `you got ${c} new comment${c > 1 ? "s" : ""}`,
        MENTIONS: (c) => `you were mentioned ${c} time${c > 1 ? "s" : ""}`,
      };

      for (const [userId, notifications] of byUser) {
        try {
          const user = notifications[0].user;
          if (!this.isUserTimezoneHour(user, 20)) continue;

          // Group by batchCategory
          const byCategory = new Map<string, typeof notifications>();
          for (const n of notifications) {
            const category = (n.relatedData as any)?.batchCategory;
            if (!category) continue;
            const list = byCategory.get(category) || [];
            list.push(n);
            byCategory.set(category, list);
          }

          if (byCategory.size === 0) continue;

          // Build summary lines
          const lines: string[] = [];
          for (const [category, catNotifications] of byCategory) {
            const labelFn = categoryLabels[category];
            if (labelFn) {
              lines.push(labelFn(catNotifications.length));
            } else {
              lines.push(`${catNotifications.length} ${category.toLowerCase()} notification${catNotifications.length > 1 ? "s" : ""}`);
            }
          }

          const body = lines.join(", ");
          const title = "daily social summary 👋";

          try {
            await notificationService.sendPushNotification(userId, title, body);
          } catch (error) {
            logger.error(`Failed to send batched push to ${user.username}:`, error);
          }

          // Mark all as sent regardless of push success (to avoid re-batching)
          const notificationIds = notifications.map((n) => n.id);
          await prisma.notification.updateMany({
            where: { id: { in: notificationIds } },
            data: { sentAt: new Date() },
          });

          sent.push(`${user.username}: ${body}`);
          logger.info(`Sent batched notification to ${user.username}: ${body}`);
        } catch (error) {
          logger.error(`Failed to process batched notifications for user ${userId}:`, error);
        }
      }

      return { sent };
    } catch (error) {
      logger.error("Error processing batched notifications:", error);
      return { sent: [] };
    }
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
    const reportEmail = process.env.ADMIN_EMAIL || "alex@tracking.so";

    await sesService.sendEmail({
      to: reportEmail,
      subject: `Daily Job for Tracking.so [${environment}] [${currentDate}]`,
      htmlBody: `<strong>Daily Job Report in ${environment} environment</strong><br><br><pre>${JSON.stringify(result, null, 2)}</pre>`,
    });
  }
}

export const recurringJobService = new RecurringJobService();
