import { User } from "@tsw/prisma";
import { subHours, subDays } from "date-fns";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { TelegramService } from "./telegramService";
import type {
  OnboardingCompletionPlan,
  OnboardingProgressPlan,
  OnboardingProgressSnapshot,
} from "./onboardingNotificationTypes";

// Telegram reaches the operator: usernames, IDs, steps and counts only, never
// emails or what people wrote (goals, reasons, notes, activity names).
const TELEGRAM_MESSAGE_LIMIT = 3900;

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 15)}... [truncated]`;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    // Stack frames only, so the message is not repeated.
    const frames = error.stack
      ?.split("\n")
      .filter((line) => line.trim().startsWith("at "))
      .join("\n");
    return {
      message: `${error.name}: ${error.message}`,
      stack: frames || null,
    };
  }

  return {
    message: String(error),
    stack: null,
  };
}

function formatUser(user: Pick<User, "id" | "username" | "createdAt" | "lastActiveAt">) {
  return [
    `User: ${user.username || "unknown"}`,
    `User ID: ${user.id}`,
    `Created: ${user.createdAt.toISOString()}`,
    `Last active: ${user.lastActiveAt?.toISOString() || "unknown"}`,
  ].join("\n");
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) || "not set";
}

function formatNullable(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "not selected";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

// Whether a free-text field was filled in, without its wording.
function formatEntered(value: string | null | undefined) {
  return value?.trim() ? "entered" : "not selected";
}

function formatStepLabel(stepId: string | null | undefined) {
  if (!stepId) return "unknown";
  return stepId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOnboardingProgressSnapshot(
  value: unknown
): OnboardingProgressSnapshot | null {
  if (!isObjectRecord(value)) return null;
  return value as OnboardingProgressSnapshot;
}

function formatOnboardingProgressPlan(
  label: string,
  plan: OnboardingProgressPlan | null | undefined
) {
  if (!plan) return [`${label}: not selected`];

  return [
    `${label}: ${plan.id || "not saved"}`,
    plan.outlineType ? `  Type: ${plan.outlineType}` : null,
    plan.timesPerWeek ? `  Frequency: ${plan.timesPerWeek}x/week` : null,
    plan.estimatedWeeks ? `  Estimated weeks: ${plan.estimatedWeeks}` : null,
    plan.coachId ? `  Coach ID: ${plan.coachId}` : null,
    `  Activities: ${plan.activities?.length || 0}`,
    typeof plan.sessionsCount === "number"
      ? `  Sessions generated: ${plan.sessionsCount}`
      : null,
  ].filter((line): line is string => line !== null);
}

function formatOnboardingCoachSelection(
  selections: NonNullable<OnboardingProgressSnapshot["selections"]>
) {
  if (selections.selectedCoach) {
    return `coach ${
      selections.selectedCoach.username || selections.selectedCoach.id || "unknown"
    }`;
  }

  if (selections.wantsCoaching === true) {
    return `AI (${formatNullable(selections.coachPersonality)})`;
  }

  if (selections.wantsCoaching === false) {
    return "self-guided";
  }

  return "not selected";
}

function formatOnboardingProgress(
  progress: unknown,
  progressUpdatedAt: Date | null | undefined
) {
  const snapshot = parseOnboardingProgressSnapshot(progress);
  if (!snapshot) {
    return [
      "",
      "Dropped at:",
      "Stage: unknown",
      "",
      "Selections:",
      "- no onboarding progress snapshot saved",
    ];
  }

  const selections = snapshot.selections || {};
  const currentStep = snapshot.currentStep || null;
  const stepLabel = snapshot.currentStepLabel || formatStepLabel(currentStep);
  const stepPosition =
    snapshot.currentStepIndex && snapshot.totalSteps
      ? ` (${snapshot.currentStepIndex}/${snapshot.totalSteps})`
      : "";
  const completedLabels =
    snapshot.completedStepLabels && snapshot.completedStepLabels.length > 0
      ? snapshot.completedStepLabels.join(", ")
      : "none";

  const generatedPlanLines =
    selections.generatedPlans && selections.generatedPlans.length > 0
      ? selections.generatedPlans.flatMap((plan, index) =>
          formatOnboardingProgressPlan(`Generated plan ${index + 1}`, plan)
        )
      : ["Generated plans: none"];

  return [
    "",
    "Dropped at:",
    `Stage: ${stepLabel}${stepPosition}`,
    `Step ID: ${formatNullable(currentStep)}`,
    `Completed steps: ${completedLabels}`,
    progressUpdatedAt
      ? `Progress snapshot updated: ${progressUpdatedAt.toISOString()}`
      : null,
    "",
    "Selections:",
    `Goal: ${formatEntered(selections.planGoal)}`,
    `Goal reason: ${formatEntered(selections.planGoalReason)}`,
    `Starting level: ${formatEntered(selections.planProgress)}`,
    `Frequency: ${formatNullable(selections.planTimesPerWeek)}${
      selections.planTimesPerWeek ? "x/week" : ""
    }`,
    `Plan type: ${formatNullable(selections.planType)}`,
    `Wants coaching: ${formatNullable(selections.wantsCoaching)}`,
    `Coach: ${formatOnboardingCoachSelection(selections)}`,
    `Push granted: ${formatNullable(selections.isPushGranted)}`,
    `Community partner: ${formatNullable(selections.partnerType)}`,
    `Selected activities: ${selections.planActivities?.length || 0}`,
    "",
    ...generatedPlanLines,
    ...formatOnboardingProgressPlan("Selected plan", selections.selectedPlan),
  ].filter((line): line is string => line !== null);
}

function describePlanCadence(plan: OnboardingCompletionPlan) {
  if (plan.outlineType === "TIMES_PER_WEEK") {
    return `${plan.timesPerWeek || "unknown"}x/week`;
  }

  if (plan.sessions.length === 0) {
    return "specific schedule, no sessions found";
  }

  const firstSession = plan.sessions[0];
  const lastSession = plan.sessions[plan.sessions.length - 1];

  return `${plan.sessions.length} scheduled sessions from ${formatDate(firstSession.date)} to ${formatDate(lastSession.date)}`;
}

function formatPlanSummary(plan: OnboardingCompletionPlan | null) {
  if (!plan) {
    return ["", "Plan created:", "No non-deleted plan found for this user."];
  }

  return [
    "",
    "Plan created:",
    `Plan ID: ${plan.id}`,
    plan.orientation ? `Orientation: ${plan.orientation}` : null,
    `Cadence: ${describePlanCadence(plan)}`,
    `Finishing date: ${formatDate(plan.finishingDate)}`,
    plan.estimatedWeeks ? `Estimated weeks: ${plan.estimatedWeeks}` : null,
    plan.coachId ? `Coach ID: ${plan.coachId}` : null,
    `Activities: ${plan.activities.length}`,
    `Sessions: ${plan.sessions.length}`,
  ].filter((line): line is string => line !== null);
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
      const [planCount, latestPlan] = await Promise.all([
        prisma.plan.count({
          where: {
            userId: user.id,
            deletedAt: null,
          },
        }),
        prisma.plan.findFirst({
          where: {
            userId: user.id,
            deletedAt: null,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            activities: {
              where: {
                deletedAt: null,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            sessions: {
              orderBy: [{ date: "asc" }, { createdAt: "asc" }],
              include: {
                activity: true,
              },
            },
          },
        }),
      ]);

      const durationMinutes = Math.max(
        0,
        Math.round((Date.now() - user.createdAt.getTime()) / 60000)
      );

      const report = [
        "ONBOARDING COMPLETED",
        "",
        formatUser(user),
        `Duration: ${durationMinutes} minutes since signup`,
        `Plans: ${planCount}`,
        ...formatPlanSummary(latestPlan),
        "",
        `Time: ${new Date().toISOString()}`,
      ].join("\n");

      await this.telegram.sendPlainMessage(
        truncate(report, TELEGRAM_MESSAGE_LIMIT)
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
      // Field names only: the body holds goals, reasons and notes.
      const requestFields = args.requestBody
        ? Object.keys(args.requestBody).join(", ") || "none"
        : "not captured";

      const report = [
        "ONBOARDING PLAN CREATION FAILED",
        "",
        formatUser(args.user),
        `Route: ${args.route}`,
        args.statusCode ? `Status: ${args.statusCode}` : null,
        `Time: ${new Date().toISOString()}`,
        "",
        `Request fields: ${requestFields}`,
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
          truncate(
            [
              "ONBOARDING DROPPED",
              "",
              formatUser(user),
              `Plans: ${planCount}`,
              "Reason: onboarding incomplete with at least 1 hour of inactivity",
              ...formatOnboardingProgress(
                user.onboardingProgress,
                user.onboardingProgressUpdatedAt
              ),
              "",
              `Time: ${now.toISOString()}`,
            ].join("\n"),
            TELEGRAM_MESSAGE_LIMIT
          )
        );

        notified.push(user.username || user.id);
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
