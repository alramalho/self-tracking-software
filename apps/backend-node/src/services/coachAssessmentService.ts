import { TZDate } from "@date-fns/tz";
import {
  Activity,
  Message,
  Plan,
  PlanSession,
  User,
} from "@tsw/prisma";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from "date-fns";
import dedent from "dedent";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { coachAgentService } from "./coachAgentService";
import { notificationService } from "./notificationService";

type CoachPlan = Plan & { activities: Activity[]; sessions: PlanSession[] };
type CoachUser = User & { plans: CoachPlan[] };

export type CoachAssessmentReason =
  | "missed_recent_sessions"
  | "dormant_plan"
  | "upcoming_session"
  | "weekly_recap"
  | "resumed_activity";

export type CoachAssessmentAction =
  | "skip"
  | "check_in"
  | "pre_activity"
  | "weekly_recap"
  | "plan_change"
  | "archive_suggestion";

export interface CoachAssessmentSignal {
  planId: string;
  planGoal: string;
  planEmoji: string | null;
  daysSinceLastActivity: number | null;
  entriesLast7Days: number;
  entriesLast30Days: number;
  missedSessionsLast7Days: number;
  upcomingSessionsTomorrow: number;
  reason: CoachAssessmentReason;
  urgency: "low" | "medium" | "high";
}

export interface CoachAssessmentDecision {
  action: CoachAssessmentAction;
  reason: string;
  urgency: "low" | "medium" | "high";
  signal?: CoachAssessmentSignal;
}

interface RunOptions {
  filter_usernames?: string[];
  dry_run?: boolean;
  force?: boolean;
  now?: Date;
}

interface UserAssessmentResult {
  username: string | null;
  userId: string;
  decision: CoachAssessmentDecision;
  sentMessageIds?: string[];
  notificationId?: string;
  skipped?: boolean;
}

interface RunResult {
  dry_run: boolean;
  enabled: boolean;
  users_checked: number;
  users_considered: number;
  messages_sent: number;
  results: UserAssessmentResult[];
}

const AUTONOMOUS_PROMPT_TAG = "autonomous_coach";
const MIN_HOURS_BETWEEN_AUTONOMOUS_PUSHES = 20;

export function isWithinPreferredCoachWindow(
  user: Pick<User, "timezone" | "preferredCoachingHour">,
  now: Date = new Date()
): boolean {
  const userTime = new TZDate(now, user.timezone || "UTC");
  const userHour = userTime.getHours();
  const preferredStartHour = user.preferredCoachingHour ?? 6;

  return userHour >= preferredStartHour && userHour < preferredStartHour + 2;
}

function hasPendingProposal(messages: Pick<Message, "metadata">[]): boolean {
  return messages.some((message) => {
    const metadata = message.metadata as any;
    const planProposals = metadata?.planProposals || [];
    const activityLogProposals = metadata?.activityLogProposals || [];

    return [...planProposals, ...activityLogProposals].some(
      (proposal: any) => !proposal.status
    );
  });
}

export function chooseCoachAssessmentDecision(params: {
  signals: CoachAssessmentSignal[];
  pendingProposal: boolean;
  recentAutonomousNotification: boolean;
  inPreferredWindow: boolean;
  force?: boolean;
}): CoachAssessmentDecision {
  const {
    signals,
    pendingProposal,
    recentAutonomousNotification,
    inPreferredWindow,
    force = false,
  } = params;

  if (!force && recentAutonomousNotification) {
    return {
      action: "skip",
      urgency: "low",
      reason: "Recent autonomous coach notification exists",
    };
  }

  if (!force && pendingProposal) {
    return {
      action: "skip",
      urgency: "low",
      reason: "User has an unresolved coach proposal",
    };
  }

  const sortedSignals = [...signals].sort((a, b) => {
    const urgencyScore = { high: 3, medium: 2, low: 1 };
    return urgencyScore[b.urgency] - urgencyScore[a.urgency];
  });
  const signal = sortedSignals[0];

  if (!signal) {
    return {
      action: "skip",
      urgency: "low",
      reason: "No meaningful coach signal",
    };
  }

  if (
    !force &&
    !inPreferredWindow &&
    signal.urgency !== "high" &&
    signal.reason !== "upcoming_session"
  ) {
    return {
      action: "skip",
      urgency: signal.urgency,
      signal,
      reason: "Waiting for user's preferred coach check-in window",
    };
  }

  if (signal.reason === "dormant_plan") {
    return {
      action: "archive_suggestion",
      urgency: "high",
      signal,
      reason: "Plan has no meaningful activity for 30+ days",
    };
  }

  if (signal.reason === "missed_recent_sessions") {
    return {
      action: "plan_change",
      urgency: signal.urgency,
      signal,
      reason: "Recent planned sessions were missed",
    };
  }

  if (signal.reason === "upcoming_session") {
    return {
      action: "pre_activity",
      urgency: "low",
      signal,
      reason: "Upcoming planned activity is due tomorrow",
    };
  }

  return {
    action: signal.reason === "weekly_recap" ? "weekly_recap" : "check_in",
    urgency: signal.urgency,
    signal,
    reason: signal.reason,
  };
}

export class CoachAssessmentService {
  async runAutonomousCoachAssessment(
    options: RunOptions = {}
  ): Promise<RunResult> {
    const {
      filter_usernames = [],
      dry_run = process.env.AUTONOMOUS_COACH_DRY_RUN !== "false",
      force = false,
      now = new Date(),
    } = options;

    const enabled = process.env.AUTONOMOUS_COACH_ENABLED === "true" || force;
    if (!enabled) {
      return {
        dry_run,
        enabled: false,
        users_checked: 0,
        users_considered: 0,
        messages_sent: 0,
        results: [],
      };
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        planType: { not: "FREE" },
        ...(filter_usernames.length > 0
          ? { username: { in: filter_usernames } }
          : {}),
        plans: {
          some: {
            isCoached: true,
            deletedAt: null,
            archivedAt: null,
            isPaused: false,
          },
        },
      },
      include: {
        plans: {
          where: {
            isCoached: true,
            deletedAt: null,
            archivedAt: null,
            isPaused: false,
          },
          include: {
            activities: true,
            sessions: true,
          },
        },
      },
    });

    const results: UserAssessmentResult[] = [];

    for (const user of users as CoachUser[]) {
      try {
        const result = await this.assessUser(user, {
          dry_run,
          force,
          now,
        });
        results.push(result);
      } catch (error) {
        logger.error(
          `Autonomous coach assessment failed for ${user.username}:`,
          error
        );
        results.push({
          userId: user.id,
          username: user.username,
          skipped: true,
          decision: {
            action: "skip",
            urgency: "low",
            reason: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }

    return {
      dry_run,
      enabled: true,
      users_checked: users.length,
      users_considered: results.filter((r) => r.decision.action !== "skip")
        .length,
      messages_sent: results.filter((r) => r.sentMessageIds?.length).length,
      results,
    };
  }

  private async assessUser(
    user: CoachUser,
    options: Required<Pick<RunOptions, "dry_run" | "force" | "now">>
  ): Promise<UserAssessmentResult> {
    const recentAutonomousNotification =
      await this.hasRecentAutonomousNotification(user.id, options.now);
    const recentMessages = await this.getRecentCoachMessages(user.id);
    const pendingProposal = hasPendingProposal(recentMessages);
    const signals = await this.collectSignals(user, options.now);

    const decision = chooseCoachAssessmentDecision({
      signals,
      pendingProposal,
      recentAutonomousNotification,
      inPreferredWindow: isWithinPreferredCoachWindow(user, options.now),
      force: options.force,
    });

    if (decision.action === "skip" || options.dry_run) {
      return {
        userId: user.id,
        username: user.username,
        skipped: decision.action === "skip",
        decision,
      };
    }

    const reminders = await prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
      },
      orderBy: { triggerAt: "asc" },
    });

    const aiResponse = await coachAgentService.generateResponse({
      user,
      message: this.buildAgentPrompt(decision),
      conversationHistory: recentMessages
        .slice(0, 8)
        .reverse()
        .map((message) => ({
          role: message.role === "USER" ? "user" : "assistant",
          content: message.content,
        })),
      plans: user.plans,
      reminders,
    });

    const { chat } = await this.ensureCoachChat(user);
    const sentMessageIds: string[] = [];

    for (const draft of aiResponse.draftMessages) {
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "COACH",
          content: draft.content,
          planId: decision.signal?.planId,
          metadata: JSON.parse(
            JSON.stringify({
              source: AUTONOMOUS_PROMPT_TAG,
              coachDecision: decision,
              planReplacements: draft.planReplacements || [],
              planProposals: draft.planProposals || [],
              activityLogProposals: draft.activityLogProposals || [],
              ...(draft.toolCalls && {
                toolCalls: draft.toolCalls,
              }),
            })
          ),
        },
      });
      sentMessageIds.push(message.id);
    }

    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    const notification = await notificationService.createAndProcessNotification(
      {
        userId: user.id,
        title: this.notificationTitle(decision),
        message: aiResponse.draftMessages[0]?.content?.substring(0, 200) || "",
        type: "COACH",
        relatedId: chat.id,
        promptTag: AUTONOMOUS_PROMPT_TAG,
        relatedData: {
          type: "AUTONOMOUS_COACH",
          decision,
          messageIds: sentMessageIds,
        },
      },
      true
    );

    return {
      userId: user.id,
      username: user.username,
      decision,
      sentMessageIds,
      notificationId: notification?.id,
    };
  }

  private async collectSignals(
    user: CoachUser,
    now: Date
  ): Promise<CoachAssessmentSignal[]> {
    const signals: CoachAssessmentSignal[] = [];
    const ninetyDaysAgo = subDays(now, 90);
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const tomorrowStart = startOfDay(addDays(now, 1));
    const tomorrowEnd = endOfDay(addDays(now, 1));
    const userDayOfWeek = new TZDate(now, user.timezone || "UTC").getDay();

    for (const plan of user.plans) {
      const activityIds = plan.activities.map((activity) => activity.id);
      if (activityIds.length === 0) continue;

      const entries = await prisma.activityEntry.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          activityId: { in: activityIds },
          datetime: { gte: ninetyDaysAgo, lte: now },
        },
        orderBy: { datetime: "desc" },
      });

      const lastEntry = entries[0];
      const daysSinceLastActivity = lastEntry
        ? differenceInCalendarDays(now, lastEntry.datetime)
        : null;
      const entriesLast7Days = entries.filter(
        (entry) => entry.datetime >= sevenDaysAgo
      ).length;
      const entriesLast30Days = entries.filter(
        (entry) => entry.datetime >= thirtyDaysAgo
      ).length;
      const missedSessionsLast7Days = plan.sessions.filter(
        (session) =>
          session.date >= sevenDaysAgo &&
          session.date < startOfDay(now) &&
          !entries.some(
            (entry) =>
              entry.activityId === session.activityId &&
              format(entry.datetime, "yyyy-MM-dd") ===
                format(session.date, "yyyy-MM-dd")
          )
      ).length;
      const upcomingSessionsTomorrow = plan.sessions.filter(
        (session) =>
          session.date >= tomorrowStart && session.date <= tomorrowEnd
      ).length;

      const baseSignal = {
        planId: plan.id,
        planGoal: plan.goal,
        planEmoji: plan.emoji,
        daysSinceLastActivity,
        entriesLast7Days,
        entriesLast30Days,
        missedSessionsLast7Days,
        upcomingSessionsTomorrow,
      };

      if (entriesLast30Days === 0) {
        signals.push({
          ...baseSignal,
          reason: "dormant_plan",
          urgency: "high",
        });
        continue;
      }

      if (missedSessionsLast7Days >= 2) {
        signals.push({
          ...baseSignal,
          reason: "missed_recent_sessions",
          urgency: "medium",
        });
        continue;
      }

      if (upcomingSessionsTomorrow > 0 && entriesLast7Days === 0) {
        signals.push({
          ...baseSignal,
          reason: "upcoming_session",
          urgency: "low",
        });
        continue;
      }

      if (
        daysSinceLastActivity !== null &&
        daysSinceLastActivity <= 2 &&
        entriesLast30Days > entriesLast7Days
      ) {
        signals.push({
          ...baseSignal,
          reason: "resumed_activity",
          urgency: "low",
        });
        continue;
      }

      if (userDayOfWeek === 1 && entriesLast7Days > 0) {
        signals.push({
          ...baseSignal,
          reason: "weekly_recap",
          urgency: "low",
        });
      }
    }

    return signals;
  }

  private async hasRecentAutonomousNotification(
    userId: string,
    now: Date
  ): Promise<boolean> {
    const since = new Date(
      now.getTime() - MIN_HOURS_BETWEEN_AUTONOMOUS_PUSHES * 60 * 60 * 1000
    );

    const notification = await prisma.notification.findFirst({
      where: {
        userId,
        type: "COACH",
        promptTag: AUTONOMOUS_PROMPT_TAG,
        createdAt: { gte: since },
      },
    });

    return !!notification;
  }

  private async getRecentCoachMessages(userId: string): Promise<Message[]> {
    const chats = await prisma.chat.findMany({
      where: { userId },
      select: { id: true },
    });

    if (chats.length === 0) return [];

    return prisma.message.findMany({
      where: {
        chatId: { in: chats.map((chat) => chat.id) },
        role: "COACH",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  private async ensureCoachChat(user: User) {
    let coach = await prisma.coach.findFirst({
      where: { ownerId: user.id },
    });

    if (!coach) {
      coach = await prisma.coach.create({
        data: {
          ownerId: user.id,
          details: {
            name: "Coach Oli",
            bio: "Your personal AI coach helping you achieve your goals",
          },
        },
      });
    }

    let chat = await prisma.chat.findFirst({
      where: { userId: user.id, coachId: coach.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          userId: user.id,
          coachId: coach.id,
          title: null,
        },
      });
    }

    return { coach, chat };
  }

  private buildAgentPrompt(decision: CoachAssessmentDecision): string {
    const signal = decision.signal;
    const signalSummary = signal
      ? dedent`
          Plan: ${signal.planEmoji || ""} ${signal.planGoal}
          Days since last activity: ${signal.daysSinceLastActivity ?? "90+"}
          Entries last 7 days: ${signal.entriesLast7Days}
          Entries last 30 days: ${signal.entriesLast30Days}
          Missed sessions last 7 days: ${signal.missedSessionsLast7Days}
          Upcoming sessions tomorrow: ${signal.upcomingSessionsTomorrow}
        `
      : "No specific plan signal.";

    return dedent`
      Autonomous coach assessment decided to reach out.
      Decision: ${decision.action}
      Urgency: ${decision.urgency}
      Reason: ${decision.reason}

      Signal:
      ${signalSummary}

      Behave like a human coach. If this is a dormant plan, take the absence seriously and propose archiving the plan with proposePlanModification using a single archive operation. If this is a recent miss, propose the smallest useful plan adjustment. If this is a pre-activity check-in, send one concise useful message and do not propose a plan change unless the schedule is clearly unrealistic.
    `;
  }

  private notificationTitle(decision: CoachAssessmentDecision): string {
    switch (decision.action) {
      case "archive_suggestion":
        return "Coach check-in";
      case "plan_change":
        return "Plan adjustment";
      case "pre_activity":
        return "Tomorrow's plan";
      case "weekly_recap":
        return "Weekly recap";
      default:
        return "Coach check-in";
    }
  }
}

export const coachAssessmentService = new CoachAssessmentService();
