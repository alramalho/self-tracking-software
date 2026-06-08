import { User } from "@tsw/prisma";
import { subHours, subDays } from "date-fns";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { TelegramService } from "./telegramService";

const TELEGRAM_MESSAGE_LIMIT = 3900;

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 15)}... [truncated]`;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      stack: error.stack || null,
    };
  }

  return {
    message: String(error),
    stack: null,
  };
}

function formatUser(user: Pick<User, "id" | "username" | "email" | "createdAt" | "lastActiveAt">) {
  return [
    `User: ${user.username || "unknown"} (${user.email})`,
    `User ID: ${user.id}`,
    `Created: ${user.createdAt.toISOString()}`,
    `Last active: ${user.lastActiveAt?.toISOString() || "unknown"}`,
  ].join("\n");
}

class OnboardingNotificationService {
  private telegram = new TelegramService();

  async markOnboardingActivity(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      logger.warn(`Failed to mark onboarding activity for user ${userId}:`, error);
    }
  }

  async sendOnboardingCompleted(user: User) {
    try {
      const planCount = await prisma.plan.count({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      });

      const durationMinutes = Math.max(
        0,
        Math.round((Date.now() - user.createdAt.getTime()) / 60000)
      );

      await this.telegram.sendPlainMessage(
        [
          "ONBOARDING COMPLETED",
          "",
          formatUser(user),
          `Duration: ${durationMinutes} minutes since signup`,
          `Plans: ${planCount}`,
          `Time: ${new Date().toISOString()}`,
        ].join("\n")
      );
    } catch (error) {
      logger.error("Failed to send onboarding completion Telegram notification:", error);
    }
  }

  async sendPlanCreationFailed(args: {
    user: User;
    route: string;
    statusCode?: number;
    requestBody?: Record<string, unknown>;
    error: unknown;
  }) {
    if (args.user.onboardingCompletedAt) return;

    try {
      const { message, stack } = describeError(args.error);
      const requestBody = args.requestBody
        ? truncate(JSON.stringify(args.requestBody, null, 2), 1100)
        : "not captured";

      const report = [
        "ONBOARDING PLAN CREATION FAILED",
        "",
        formatUser(args.user),
        `Route: ${args.route}`,
        args.statusCode ? `Status: ${args.statusCode}` : null,
        `Time: ${new Date().toISOString()}`,
        "",
        "Request:",
        requestBody,
        "",
        "Error:",
        message,
        stack ? ["", "Stack:", truncate(stack, 1500)].join("\n") : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      await this.telegram.sendPlainMessage(truncate(report, TELEGRAM_MESSAGE_LIMIT));
    } catch (error) {
      logger.error("Failed to send onboarding plan failure Telegram notification:", error);
    }
  }

  async processInactiveOnboardingUsers() {
    const now = new Date();
    const inactiveBefore = subHours(now, 1);
    const recentSignupAfter = subDays(now, 14);

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        onboardingCompletedAt: null,
        onboardingDropNotifiedAt: null,
        createdAt: { gte: recentSignupAfter, lte: inactiveBefore },
        OR: [{ lastActiveAt: null }, { lastActiveAt: { lte: inactiveBefore } }],
        AND: [
          { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
          { email: { not: { endsWith: "@test.com" } } },
          { email: { not: "alex@chatarmin.com" } },
          { email: { not: { startsWith: "lia.borges+" } } },
        ],
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    const notified: string[] = [];

    for (const user of users) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { onboardingDropNotifiedAt: now },
        });

        const planCount = await prisma.plan.count({
          where: { userId: user.id, deletedAt: null },
        });

        await this.telegram.sendPlainMessage(
          [
            "ONBOARDING DROPPED",
            "",
            formatUser(user),
            `Plans: ${planCount}`,
            "Reason: onboarding incomplete with at least 1 hour of inactivity",
            `Time: ${now.toISOString()}`,
          ].join("\n")
        );

        notified.push(user.username || user.email);
      } catch (error) {
        logger.error(`Failed to process inactive onboarding user ${user.id}:`, error);
      }
    }

    return {
      checked: users.length,
      notified,
    };
  }
}

export const onboardingNotificationService = new OnboardingNotificationService();
