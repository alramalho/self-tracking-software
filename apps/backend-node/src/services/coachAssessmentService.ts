import { TZDate } from "@date-fns/tz";
import {
  Activity,
  Message,
  Plan,
  PlanSession,
  User,
} from "@tsw/prisma";
import {
  differenceInCalendarDays,
  differenceInHours,
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

interface RunOptions {
  filter_usernames?: string[];
  dry_run?: boolean;
  force?: boolean;
  now?: Date;
}

interface UserAssessmentResult {
  username: string | null;
  userId: string;
  action: "sent" | "skipped" | "agent_skipped" | "error";
  reason: string;
  sentMessageIds?: string[];
  notificationId?: string;
}

interface RunResult {
  dry_run: boolean;
  enabled: boolean;
  users_checked: number;
  messages_sent: number;
  results: UserAssessmentResult[];
}

const AUTONOMOUS_PROMPT_TAG = "autonomous_coach";
const GLOBAL_COOLDOWN_HOURS = 24;
const AUTO_ACCEPT_HOURS = 48;

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
      return { dry_run, enabled: false, users_checked: 0, messages_sent: 0, results: [] };
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
          include: { activities: true, sessions: true },
        },
      },
    });

    const results: UserAssessmentResult[] = [];

    for (const user of users as CoachUser[]) {
      try {
        const result = await this.assessUser(user, { dry_run, force, now });
        results.push(result);
      } catch (error) {
        logger.error(`Autonomous coach assessment failed for ${user.username}:`, error);
        results.push({
          userId: user.id,
          username: user.username,
          action: "error",
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      dry_run,
      enabled: true,
      users_checked: users.length,
      messages_sent: results.filter((r) => r.action === "sent").length,
      results,
    };
  }

  async autoAcceptExpiredProposals(now: Date = new Date()): Promise<{
    processed: number;
    accepted: number;
    errors: number;
  }> {
    const cutoff = new Date(now.getTime() - AUTO_ACCEPT_HOURS * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: {
        role: "COACH",
        createdAt: { lte: cutoff },
        metadata: { path: ["source"], equals: AUTONOMOUS_PROMPT_TAG },
      },
      include: { chat: true },
      orderBy: { createdAt: "asc" },
    });

    let processed = 0;
    let accepted = 0;
    let errors = 0;

    for (const message of messages) {
      const metadata = message.metadata as any;
      const proposals: any[] = metadata?.planProposals || [];
      let changed = false;

      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        if (proposal.status) continue;

        processed++;
        changed = true;

        try {
          const plan = await prisma.plan.findFirst({
            where: { id: proposal.planId, deletedAt: null },
            include: { activities: true, sessions: true },
          });

          if (!plan) {
            proposals[i].status = "auto_accepted";
            proposals[i].autoAcceptNote = "Plan no longer exists";
            continue;
          }

          await this.executeProposalOperations(plan, proposal.operations);
          proposals[i].status = "auto_accepted";
          proposals[i].autoAcceptedAt = now.toISOString();
          accepted++;

          logger.info(
            `Auto-accepted proposal "${proposal.description}" for plan "${plan.goal}" after ${AUTO_ACCEPT_HOURS}h`
          );
        } catch (error) {
          logger.error(`Failed to auto-accept proposal:`, error);
          proposals[i].status = "auto_accept_failed";
          errors++;
        }
      }

      if (changed) {
        metadata.planProposals = proposals;
        await prisma.message.update({
          where: { id: message.id },
          data: { metadata },
        });
      }
    }

    return { processed, accepted, errors };
  }

  private async executeProposalOperations(
    plan: Plan & { activities: Activity[]; sessions: PlanSession[] },
    operations: any[]
  ): Promise<void> {
    for (const op of operations) {
      if (op.type === "add") {
        const sessionDate = new Date(op.date);
        await prisma.planSession.create({
          data: {
            planId: plan.id,
            activityId: op.activityId,
            date: new Date(
              Date.UTC(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate())
            ),
            quantity: op.quantity,
            descriptiveGuide: op.descriptiveGuide || "",
            isCoachSuggested: true,
          },
        });
      } else if (op.type === "update") {
        const updateData: Record<string, unknown> = {};
        if (op.date) {
          const d = new Date(op.date);
          updateData.date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        }
        if (op.quantity !== undefined) updateData.quantity = op.quantity;
        if (op.descriptiveGuide !== undefined) updateData.descriptiveGuide = op.descriptiveGuide;
        await prisma.planSession.update({ where: { id: op.sessionId }, data: updateData });
      } else if (op.type === "remove") {
        await prisma.planSession.delete({ where: { id: op.sessionId } });
      } else if (op.type === "pause") {
        const pauseHistory = ((plan as any).pauseHistory as any[]) || [];
        pauseHistory.push({
          pausedAt: new Date().toISOString(),
          reason: op.reason || "Coach paused due to inactivity",
        });
        await prisma.plan.update({
          where: { id: plan.id },
          data: {
            isPaused: true,
            pauseReason: op.reason || "Coach paused due to inactivity",
            pauseHistory,
          },
        });
      } else if (op.type === "archive") {
        await prisma.plan.update({
          where: { id: plan.id },
          data: {
            archivedAt: new Date(),
            isCoached: false,
            coachSuggestedTimesPerWeek: null,
            coachNotes: null,
          },
        });
      }
    }
  }

  private async assessUser(
    user: CoachUser,
    options: Required<Pick<RunOptions, "dry_run" | "force" | "now">>
  ): Promise<UserAssessmentResult> {
    const { now, force, dry_run } = options;

    // Guard: preferred window
    if (!force && !isWithinPreferredCoachWindow(user, now)) {
      return { userId: user.id, username: user.username, action: "skipped", reason: "Outside preferred window" };
    }

    // Guard: global cooldown
    const hoursSinceLast = await this.hoursSinceLastAutonomous(user.id, now);
    if (!force && hoursSinceLast !== null && hoursSinceLast < GLOBAL_COOLDOWN_HOURS) {
      return { userId: user.id, username: user.username, action: "skipped", reason: `Global cooldown (${Math.round(hoursSinceLast)}h < ${GLOBAL_COOLDOWN_HOURS}h)` };
    }

    // Guard: pending proposal
    const recentMessages = await this.getRecentCoachMessages(user.id);
    if (!force && hasPendingProposal(recentMessages)) {
      return { userId: user.id, username: user.username, action: "skipped", reason: "Pending proposal exists" };
    }

    // Build context snapshot for the coach agent
    const contextSummary = await this.buildContextSummary(user, now);

    if (dry_run) {
      return { userId: user.id, username: user.username, action: "skipped", reason: `Dry run. Context: ${contextSummary.substring(0, 200)}` };
    }

    // Hand off to the coach agent — it decides what to do
    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { triggerAt: "asc" },
    });

    const prompt = dedent`
      You are doing your daily review of this user's plans. Look at the context below and decide whether to reach out.

      ${contextSummary}

      Guidelines:
      - If everything is on track, call skipOutreach. Silence is fine.
      - If a plan has been inactive for 7-13 days, send a short warm check-in. No proposal.
      - If a plan has been inactive for 14-29 days, propose pausing it with proposePlanModification (single pause operation). Be direct.
      - If a plan has been inactive for 30+ days, propose archiving it with proposePlanModification (single archive operation).
      - If 3+ sessions were missed this week, propose reducing the schedule to something realistic.
      - If the user completed all sessions this week, send a short genuine congratulation. No proposal.
      - On Mondays, if there was activity last week, do a brief weekly recap (use readActivities for 7 days).
      - If you propose a change, mention the user has 48 hours to decline before it applies automatically.
      - Keep messages to 2-3 sentences max. Be opinionated — you're an accountability coach, not a suggestion box.
    `;

    const aiResponse = await coachAgentService.generateResponse({
      user,
      message: prompt,
      conversationHistory: recentMessages
        .slice(0, 8)
        .reverse()
        .map((m) => ({ role: m.role === "USER" ? "user" as const : "assistant" as const, content: m.content })),
      plans: user.plans,
      reminders,
    });

    if (aiResponse.skipped || aiResponse.draftMessages.length === 0) {
      return {
        userId: user.id,
        username: user.username,
        action: "agent_skipped",
        reason: aiResponse.skipReason || "Agent decided no outreach needed",
      };
    }

    // Dispatch messages + notification
    const { chat } = await this.ensureCoachChat(user);
    const sentMessageIds: string[] = [];

    for (const draft of aiResponse.draftMessages) {
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "COACH",
          content: draft.content,
          metadata: JSON.parse(
            JSON.stringify({
              source: AUTONOMOUS_PROMPT_TAG,
              planReplacements: draft.planReplacements || [],
              planProposals: draft.planProposals || [],
              activityLogProposals: draft.activityLogProposals || [],
              ...(draft.toolCalls && { toolCalls: draft.toolCalls }),
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

    const hasProposal = aiResponse.draftMessages.some(
      (d) => (d.planProposals && d.planProposals.length > 0) || (d.activityLogProposals && d.activityLogProposals.length > 0)
    );

    const notification = await notificationService.createAndProcessNotification(
      {
        userId: user.id,
        title: hasProposal ? "Plan adjustment" : "Coach check-in",
        message: aiResponse.draftMessages[0]?.content?.substring(0, 200) || "",
        type: "COACH",
        relatedId: chat.id,
        promptTag: AUTONOMOUS_PROMPT_TAG,
        relatedData: {
          type: "AUTONOMOUS_COACH",
          messageIds: sentMessageIds,
        },
      },
      true
    );

    return {
      userId: user.id,
      username: user.username,
      action: "sent",
      reason: hasProposal ? "Sent with proposal" : "Sent check-in",
      sentMessageIds,
      notificationId: notification?.id,
    };
  }

  private async buildContextSummary(user: CoachUser, now: Date): Promise<string> {
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);
    const userDayOfWeek = new TZDate(now, user.timezone || "UTC").getDay();
    const lines: string[] = [];

    lines.push(`Today: ${format(now, "yyyy-MM-dd (EEEE)")}`);
    lines.push(`Day of week: ${userDayOfWeek === 1 ? "Monday (recap day)" : format(now, "EEEE")}`);
    lines.push("");

    for (const plan of user.plans) {
      const activityIds = plan.activities.map((a) => a.id);
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
      const entriesLast7Days = entries.filter((e) => e.datetime >= sevenDaysAgo).length;
      const entriesLast30Days = entries.filter((e) => e.datetime >= thirtyDaysAgo).length;

      const sessionsLast7Days = plan.sessions.filter(
        (s) => s.date >= sevenDaysAgo && s.date < startOfDay(now)
      );
      const totalSessions = sessionsLast7Days.length;
      const completedSessions = sessionsLast7Days.filter((session) =>
        entries.some(
          (entry) =>
            entry.activityId === session.activityId &&
            format(entry.datetime, "yyyy-MM-dd") === format(session.date, "yyyy-MM-dd")
        )
      ).length;
      const missedSessions = totalSessions - completedSessions;

      lines.push(`Plan: ${plan.emoji || ""} ${plan.goal}`);
      lines.push(`  Last activity: ${daysSinceLastActivity !== null ? `${daysSinceLastActivity} days ago` : "never"}`);
      lines.push(`  Entries last 7 days: ${entriesLast7Days}`);
      lines.push(`  Entries last 30 days: ${entriesLast30Days}`);
      lines.push(`  Sessions this week: ${completedSessions}/${totalSessions} completed, ${missedSessions} missed`);
      lines.push("");
    }

    return lines.join("\n");
  }

  private async hoursSinceLastAutonomous(userId: string, now: Date): Promise<number | null> {
    const notification = await prisma.notification.findFirst({
      where: { userId, type: "COACH", promptTag: AUTONOMOUS_PROMPT_TAG },
      orderBy: { createdAt: "desc" },
    });
    if (!notification) return null;
    return differenceInHours(now, notification.createdAt);
  }

  private async getRecentCoachMessages(userId: string): Promise<Message[]> {
    const chats = await prisma.chat.findMany({
      where: { userId },
      select: { id: true },
    });
    if (chats.length === 0) return [];
    return prisma.message.findMany({
      where: { chatId: { in: chats.map((c) => c.id) }, role: "COACH" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  private async ensureCoachChat(user: User) {
    let coach = await prisma.coach.findFirst({ where: { ownerId: user.id } });
    if (!coach) {
      coach = await prisma.coach.create({
        data: {
          ownerId: user.id,
          details: { name: "Coach Oli", bio: "Your personal AI coach helping you achieve your goals" },
        },
      });
    }

    let chat = await prisma.chat.findFirst({
      where: { userId: user.id, coachId: coach.id },
      orderBy: { updatedAt: "desc" },
    });
    if (!chat) {
      chat = await prisma.chat.create({
        data: { userId: user.id, coachId: coach.id, title: null },
      });
    }

    return { coach, chat };
  }
}

export const coachAssessmentService = new CoachAssessmentService();
