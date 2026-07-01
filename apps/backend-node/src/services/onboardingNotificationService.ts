import { User } from "@tsw/prisma";
import { subHours, subDays } from "date-fns";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { TelegramService } from "./telegramService";
import type {
  OnboardingCompletionPlan,
  OnboardingProgressActivity,
  OnboardingProgressPlan,
  OnboardingProgressSnapshot,
} from "./onboardingNotificationTypes";

const TELEGRAM_MESSAGE_LIMIT = 3900;
const PLAN_NOTES_SUMMARY_LIMIT = 450;
const ACTIVITY_LIST_LIMIT = 12;
const SESSION_PREVIEW_LIMIT = 4;
const SELECTION_TEXT_LIMIT = 220;

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

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) || "not set";
}

function compactText(value: string | null | undefined, maxLength: number) {
  if (!value) return null;

  const compacted = value.replace(/\s+/g, " ").trim();
  if (!compacted) return null;

  return truncate(compacted, maxLength);
}

function formatNullable(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "not selected";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
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

function formatOnboardingProgressActivity(activity: OnboardingProgressActivity) {
  const label = compactText(
    `${activity.emoji || ""} ${activity.title || "Untitled activity"}`.trim(),
    90
  );
  const measure = compactText(activity.measure, 60);
  return measure ? `${label} (${measure})` : label || "Untitled activity";
}

function formatOnboardingProgressActivities(
  activities: OnboardingProgressActivity[] | null | undefined
) {
  if (!activities || activities.length === 0) return ["- none selected"];

  const lines = activities
    .slice(0, ACTIVITY_LIST_LIMIT)
    .map((activity) => `- ${formatOnboardingProgressActivity(activity)}`);

  const remainingCount = activities.length - lines.length;
  if (remainingCount > 0) {
    lines.push(`- +${remainingCount} more`);
  }

  return lines;
}

function formatOnboardingProgressPlan(
  label: string,
  plan: OnboardingProgressPlan | null | undefined
) {
  if (!plan) return [`${label}: not selected`];

  const goal = compactText(
    `${plan.emoji || ""} ${plan.goal || "Untitled plan"}`.trim(),
    SELECTION_TEXT_LIMIT
  );

  return [
    `${label}: ${goal}`,
    plan.goalReason
      ? `  Reason: ${compactText(plan.goalReason, SELECTION_TEXT_LIMIT)}`
      : null,
    plan.outlineType ? `  Type: ${plan.outlineType}` : null,
    plan.timesPerWeek ? `  Frequency: ${plan.timesPerWeek}x/week` : null,
    plan.estimatedWeeks ? `  Estimated weeks: ${plan.estimatedWeeks}` : null,
    plan.coachId ? `  Coach ID: ${plan.coachId}` : null,
    typeof plan.sessionsCount === "number"
      ? `  Sessions generated: ${plan.sessionsCount}`
      : null,
  ].filter((line): line is string => line !== null);
}

function formatOnboardingCoachSelection(
  selections: NonNullable<OnboardingProgressSnapshot["selections"]>
) {
  if (selections.selectedCoach) {
    return [
      selections.selectedCoach.name || selections.selectedCoach.username,
      selections.selectedCoach.title,
    ]
      .filter(Boolean)
      .join(" - ");
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
    `Goal: ${compactText(
      `${selections.planEmoji || ""} ${selections.planGoal || ""}`.trim(),
      SELECTION_TEXT_LIMIT
    ) || "not selected"}`,
    `Goal reason: ${
      compactText(selections.planGoalReason, SELECTION_TEXT_LIMIT) ||
      "not selected"
    }`,
    selections.planCoachNotes
      ? `Reason notes: ${compactText(selections.planCoachNotes, SELECTION_TEXT_LIMIT)}`
      : null,
    `Frequency: ${formatNullable(selections.planTimesPerWeek)}${
      selections.planTimesPerWeek ? "x/week" : ""
    }`,
    `Starting level: ${
      compactText(selections.planProgress, SELECTION_TEXT_LIMIT) ||
      "not selected"
    }`,
    `Plan type: ${formatNullable(selections.planType)}`,
    `Wants coaching: ${formatNullable(selections.wantsCoaching)}`,
    `Coach: ${formatOnboardingCoachSelection(selections)}`,
    `Push granted: ${formatNullable(selections.isPushGranted)}`,
    `Community partner: ${formatNullable(selections.partnerType)}`,
    "",
    `Selected activities (${selections.planActivities?.length || 0}):`,
    ...formatOnboardingProgressActivities(selections.planActivities),
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

function formatPlanActivities(plan: OnboardingCompletionPlan) {
  const activityLines = plan.activities
    .slice(0, ACTIVITY_LIST_LIMIT)
    .map((activity) => {
      const measure = compactText(activity.measure, 80);
      const label = `${activity.emoji || ""} ${activity.title}`.trim();
      return measure ? `- ${label} (${measure})` : `- ${label}`;
    });

  const remainingCount = plan.activities.length - activityLines.length;
  if (remainingCount > 0) {
    activityLines.push(`- +${remainingCount} more`);
  }

  return activityLines.length > 0 ? activityLines : ["- none found"];
}

function formatSessionPreview(plan: OnboardingCompletionPlan) {
  if (plan.sessions.length === 0) return [];

  return [
    `First sessions: ${plan.sessions
      .slice(0, SESSION_PREVIEW_LIMIT)
      .map((session) => {
        const label =
          `${formatDate(session.date)} ${session.activity.emoji || ""} ${session.activity.title}`.trim();
        return session.quantity
          ? `${label} - ${session.quantity} ${session.activity.measure}`
          : label;
      })
      .join("; ")}${plan.sessions.length > SESSION_PREVIEW_LIMIT ? "; ..." : ""}`,
  ];
}

function formatPlanSummary(plan: OnboardingCompletionPlan | null) {
  if (!plan) {
    return ["", "Plan created:", "No non-deleted plan found for this user."];
  }

  const goal = `${plan.emoji || ""} ${plan.goal}`.trim();
  const goalReason = compactText(plan.goalReason, PLAN_NOTES_SUMMARY_LIMIT);
  const notes = compactText(plan.notes, PLAN_NOTES_SUMMARY_LIMIT);

  return [
    "",
    "Plan created:",
    `Goal: ${goal}`,
    goalReason ? `Reason: ${goalReason}` : null,
    `Cadence: ${describePlanCadence(plan)}`,
    `Finishing date: ${formatDate(plan.finishingDate)}`,
    plan.estimatedWeeks ? `Estimated weeks: ${plan.estimatedWeeks}` : null,
    plan.coachId ? `Coach ID: ${plan.coachId}` : null,
    notes ? `Notes: ${notes}` : null,
    ...formatSessionPreview(plan),
    "",
    `Included activities (${plan.activities.length}):`,
    ...formatPlanActivities(plan),
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
