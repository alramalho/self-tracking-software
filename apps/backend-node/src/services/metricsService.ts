import { TZDate } from "@date-fns/tz";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";

export class MetricsService {
  /**
   * Check if any metrics are loggable now for a given user
   * A metric is loggable if:
   * 1. It has no entry for today
   * 2. Current time is after 2PM (in the user's timezone)
   *
   * @param userId - The user ID to check metrics for
   * @returns true if there are pending metrics to log, false otherwise
   */
  async isMetricLoggableNow(userId: string): Promise<boolean> {
    try {
      // Get user to access their timezone
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });

      if (!user) {
        logger.error(
          `User ${userId} not found when checking metric loggability`
        );
        return false;
      }

      // Get current time in user's timezone using TZDate
      const userTimezone = user.timezone || "UTC";
      const now = new Date();
      const userLocalTime = new TZDate(now, userTimezone);
      const currentHour = userLocalTime.getHours();

      // Check if it's after 2PM (14:00) in user's timezone
      // if (currentHour > 14) {
      //   logger.debug(
      //     `User ${userId} local time is ${currentHour}:00 (${userTimezone}), before 2PM - metrics not loggable yet`
      //   );
      //   return false;
      // }

      // Get all metrics for the user
      const metrics = await prisma.metric.findMany({
        where: {
          userId: userId,
        },
      });

      if (metrics.length === 0) {
        logger.debug(`No metrics found for user ${userId}`);
        return false;
      }

      // Get today's date at midnight in user's timezone (to match date-only comparisons)
      const todayInUserTz = new TZDate(now, userTimezone);
      todayInUserTz.setHours(0, 0, 0, 0);

      // Check if any metric has no entry for today (in user's timezone)
      const metricsWithoutTodayEntry = await Promise.all(
        metrics.map(async (metric) => {
          const existingEntry = await prisma.metricEntry.findFirst({
            where: {
              userId: userId,
              metricId: metric.id,
              date: todayInUserTz,
            },
          });

          return existingEntry === null;
        })
      );

      const hasPendingMetrics = metricsWithoutTodayEntry.some(
        (hasNone) => hasNone
      );

      logger.debug(
        `User ${userId} has ${metrics.length} metrics, ${metricsWithoutTodayEntry.filter((x) => x).length} pending for today. Loggable: ${hasPendingMetrics}`
      );

      return hasPendingMetrics;
    } catch (error) {
      logger.error("Error checking if metrics are loggable:", error);
      // Fail open - if we can't determine, don't block metric extraction
      return true;
    }
  }
}

export const metricsService = new MetricsService();
