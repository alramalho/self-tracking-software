import { User } from "@tsw/prisma";
import { subHours, subDays } from "date-fns";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { TelegramService } from "./telegramService";
import { realPeople } from "./analytics/people";
import { onboardingReach } from "./analytics/funnel";
import type { OnboardingProgressSnapshot } from "./onboardingNotificationTypes";

// Telegram reaches the operator: one line per event, usernames and steps only, never emails or what people
// wrote (goals, reasons, notes, activity names). Details live on tracking.so/analytics.
const TELEGRAM_MESSAGE_LIMIT = 3900;

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function since(date: Date, now = new Date()) {
  const minutes = Math.max(1, Math.round((now.getTime() - date.getTime()) / 60000));
  if (minutes < 120) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

/** The screen someone is on, by how far their draft got (see analytics/funnel.ts). */
const SCREENS = ["the goal question", "where they start", "why", "rhythm / route", "coach choice", "plan review", "the paywall"];

/** Where someone stopped: the iPhone draft (coaching state) first, else the web progress snapshot. */
function stoppedAt(user: Pick<User, "onboardingProgress">, draft: unknown) {
  if (draft) return SCREENS[onboardingReach(draft as Parameters<typeof onboardingReach>[0])] ?? "the end";
  const snapshot = user.onboardingProgress as OnboardingProgressSnapshot | null;
  if (snapshot?.currentStepLabel) {
    const position = snapshot.currentStepIndex && snapshot.totalSteps ? ` (${snapshot.currentStepIndex}/${snapshot.totalSteps})` : "";
    return `${snapshot.currentStepLabel}${position}`;
  }
  return "the first question";
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

  async sendOnboardingCompleted(user: User, coached?: boolean) {
    try {
      const coaching = coached === undefined ? "" : coached ? " · coached" : " · free";
      await this.telegram.sendPlainMessage(
        `✅ ${user.username || user.id} finished onboarding in ${since(user.createdAt)}${coaching}`
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
      const message = args.error instanceof Error ? args.error.message : String(args.error);
      await this.telegram.sendRepeatable(
        `onboarding-plan:${args.route}:${message}`,
        truncate(`⚠️ Onboarding plan failed for ${args.user.username || args.user.id} · ${args.route}: ${message}`, 400),
        "activity"
      );
    } catch (error) {
      logger.error("Failed to send onboarding plan failure Telegram notification:", error);
    }
  }

  /** Hourly: everyone who stopped onboarding an hour or more ago, in one message. */
  async processInactiveOnboardingUsers() {
    const now = new Date();
    const inactiveBefore = subHours(now, 1);
    const recentSignupAfter = subDays(now, 14);

    const users = await prisma.user.findMany({
      where: {
        ...realPeople,
        onboardingCompletedAt: null,
        onboardingDropNotifiedAt: null,
        createdAt: { gte: recentSignupAfter, lte: inactiveBefore },
        OR: [{ lastActiveAt: null }, { lastActiveAt: { lte: inactiveBefore } }],
      },
      include: { coachingState: { select: { data: true } } },
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    if (users.length === 0) return { checked: 0, notified: [] as string[] };

    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { onboardingDropNotifiedAt: now },
    });

    const lines = users.map((user) => {
      const draft = (user.coachingState?.data as { draft?: unknown } | null)?.draft;
      return `• ${user.username || user.id} at ${stoppedAt(user, draft)} · signed up ${since(user.createdAt, now)} ago`;
    });
    const heading = users.length === 1 ? "🚪 Stopped onboarding" : `🚪 ${users.length} stopped onboarding`;
    try {
      await this.telegram.sendPlainMessage(truncate([heading, ...lines].join("\n"), TELEGRAM_MESSAGE_LIMIT));
    } catch (error) {
      logger.error("Failed to send onboarding drop Telegram notification:", error);
    }

    return { checked: users.length, notified: users.map((u) => u.username || u.id) };
  }
}

export const onboardingNotificationService = new OnboardingNotificationService();
