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
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import dedent from "dedent";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { coachAgentService } from "./coachAgentService";
import { coachContextBriefService } from "./coachContextBriefService";
import { getCoachPersonalityConfig } from "./coachPersonalityService";
import { aiService } from "./aiService";
import { notificationService } from "./notificationService";

type CoachPlan = Plan & { activities: Activity[]; sessions: PlanSession[] };
type CoachUser = User & { plans: CoachPlan[] };

interface RunOptions {
  filter_usernames?: string[];
  dry_run?: boolean;
  force?: boolean;
  now?: Date;
}

interface AssessOptions extends Required<Pick<RunOptions, "dry_run" | "force" | "now">> {
  bypassDuplicateCheck?: boolean;
  fallbackCheckin?: boolean;
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
const AUTO_ACCEPT_HOURS = 48;

type CoachInterventionType =
  | "INACTIVITY_ARCHIVE_PROPOSAL"
  | "INACTIVITY_PAUSE_PROPOSAL"
  | "PLAN_ADJUSTMENT"
  | "COACH_SETUP"
  | "WEEK_PREP"
  | "SESSION_PREP"
  | "WEEK_RECAP"
  | "INACTIVITY_CHECKIN"
  | "CELEBRATION"
  | "STATUS_REVIEW";

type CoachInterventionCandidate = {
  type: CoachInterventionType;
  reason: string;
  planIds: string[];
  sessionIds?: string[];
  targetDate?: string;
  targetWeekStart?: string;
  context: string;
  usesAgent: boolean;
};

const INTERVENTION_PRIORITY: CoachInterventionType[] = [
  "INACTIVITY_ARCHIVE_PROPOSAL",
  "INACTIVITY_PAUSE_PROPOSAL",
  "PLAN_ADJUSTMENT",
  "WEEK_PREP",
  "SESSION_PREP",
  "WEEK_RECAP",
  "INACTIVITY_CHECKIN",
  "CELEBRATION",
];

function activePlanWhere(now: Date) {
  return {
    deletedAt: null,
    archivedAt: null,
    isPaused: false,
    OR: [{ finishingDate: null }, { finishingDate: { gt: now } }],
  };
}

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
            ...activePlanWhere(now),
          },
        },
      },
      include: {
        plans: {
          where: {
            ...activePlanWhere(now),
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

  async runManualCoachAssessmentForUser(
    userId: string,
    options: { now?: Date } = {}
  ): Promise<UserAssessmentResult> {
    const now = options.now || new Date();
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        plans: {
          where: {
            ...activePlanWhere(now),
          },
          include: { activities: true, sessions: true },
        },
      },
    });

    if (!user) {
      return {
        userId,
        username: null,
        action: "skipped",
        reason: "User not found",
      };
    }

    const coachUser = user as CoachUser;
    if (coachUser.plans.length === 0) {
      return this.runCoachSetupCheckin(coachUser, now);
    }

    // Manual assessment is a fresh introductory status review: call the coach
    // brain directly instead of going through the proactive intervention picker.
    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { triggerAt: "asc" },
    });

    const aiResponse = await coachAgentService.generateResponse({
      user,
      message: this.buildStatusReviewPrompt(),
      conversationHistory: [],
      plans: coachUser.plans,
      reminders,
    });

    logger.info(
      `[coach-assessment] manual status review user=${user.username} plans=${coachUser.plans.length} drafts=${aiResponse.draftMessages.length} skipped=${aiResponse.skipped}`
    );

    if (aiResponse.skipped || aiResponse.draftMessages.length === 0) {
      return {
        userId: user.id,
        username: user.username,
        action: "agent_skipped",
        reason: aiResponse.skipReason || "Agent produced no assessment",
      };
    }

    const candidate: CoachInterventionCandidate = {
      type: "STATUS_REVIEW",
      reason: "User requested a coach assessment.",
      planIds: coachUser.plans.map((p) => p.id),
      context: "",
      usesAgent: true,
    };

    const sent = await this.dispatchCoachDrafts(
      user,
      candidate,
      aiResponse.draftMessages,
      "Coach assessment"
    );

    return {
      userId: user.id,
      username: user.username,
      action: "sent",
      reason: "Sent STATUS_REVIEW",
      sentMessageIds: sent.messageIds,
      notificationId: sent.notificationId,
    };
  }

  private buildStatusReviewPrompt(): string {
    return dedent`
      You are doing an introductory status check-in with the user. This is a fresh
      assessment — do not treat it as a continuation of a prior conversation.

      Required:
      - Open with a brief read on where they stand across their active plans, using
        USER'S PLANS + RECENT ACTIVITY FACTS only.
      - Give a one-line status-vs-goal take per meaningful plan (on track / slipping / strong).
      - End with one concrete, realistic next step, or a single question to align focus.
      - Use 2-3 short messages. Keep each to 1-2 short sentences. Sound like a sharp
        friend texting, not a report.
      - Don't invent activity the user hasn't logged. If a plan has no recent activity, say so plainly.
    `;
  }

  private async runCoachSetupCheckin(
    user: CoachUser,
    now: Date
  ): Promise<UserAssessmentResult> {
    const recentMessages = await this.getRecentCoachMessages(user.id);
    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { triggerAt: "asc" },
    });

    const activePlanSummary = user.plans.length > 0
      ? user.plans
          .map((plan) => `- ${plan.emoji || ""} ${plan.goal}${plan.outlineType === "TIMES_PER_WEEK" && plan.timesPerWeek ? ` (${plan.timesPerWeek}x/week)` : ""}`)
          .join("\n")
      : "No active plans.";

    const aiResponse = await coachAgentService.generateResponse({
      user,
      message: dedent`
        The user manually ran a coach assessment, but they have no active coached plans.

        This is a setup moment, not an error.

        Active plans:
        ${activePlanSummary}

        Required behavior:
        - Speak as the coach in first person. Do not say "No active coach plans".
        - If there are active plans, inspect whether any goal is vague, purely frequency-based, or missing a measurable outcome.
        - When you critique or ask about an existing plan, include that plan's exact goal text from Active plans in your message so the UI can link it.
        - If a plan is vague, ask whether they want to turn that exact plan into a clearer goal.
        - Also offer creating a new coached plan if none of the existing plans should change.
        - If there are no active plans, ask what measurable goal they want coached first.
        - Sound natural and conversational. Avoid corporate phrases like "To coach you effectively".
        - Do not use em dashes. Use commas, periods, or parentheses instead.
        - Ask at most one crisp question. Do not propose a setup tool until the user gives a concrete target or confirms what to change.
      `,
      conversationHistory: recentMessages
        .slice(0, 8)
        .reverse()
        .map((m) => ({ role: m.role === "USER" ? "user" as const : "assistant" as const, content: m.content })),
      plans: user.plans,
      reminders,
    });

    const candidate: CoachInterventionCandidate = {
      type: "COACH_SETUP",
      reason: "User requested a coach assessment without an active coached plan.",
      planIds: user.plans.map((plan) => plan.id),
      targetDate: format(new TZDate(now, user.timezone || "UTC"), "yyyy-MM-dd"),
      context: activePlanSummary,
      usesAgent: true,
    };

    const drafts = aiResponse.draftMessages.length > 0
      ? aiResponse.draftMessages
      : [{ content: "I do not have a coached plan set up for you yet. Do you want to tighten one of your current plans into a measurable goal, or create a new coached plan?" }];

    const sent = await this.dispatchCoachDrafts(user, candidate, drafts, "Coach setup");

    return {
      userId: user.id,
      username: user.username,
      action: "sent",
      reason: "Sent coach setup check-in",
      sentMessageIds: sent.messageIds,
      notificationId: sent.notificationId,
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
    options: AssessOptions
  ): Promise<UserAssessmentResult> {
    const { now, force, dry_run, bypassDuplicateCheck = false, fallbackCheckin = false } = options;

    const recentMessages = await this.getRecentCoachMessages(user.id);
    const pendingProposalExists = hasPendingProposal(recentMessages);
    const candidates = await this.buildInterventionCandidates(user, now, {
      force,
      pendingProposalExists,
      fallbackCheckin,
    });
    const candidate = await this.selectInterventionCandidate(user, candidates, {
      bypassDuplicateCheck,
    });

    logger.info(
      `[coach-assessment] user=${user.username} historyMessages=${recentMessages.length} bypassDuplicateCheck=${bypassDuplicateCheck} candidates=[${candidates
        .map((c) => c.type)
        .join(",")}] selected=${candidate?.type ?? "none"}`
    );

    if (candidate && candidate.type !== "COACH_SETUP") {
      const brief = await coachContextBriefService.buildCoachContextBrief({
        user,
        plans: user.plans,
        now,
      });
      const selectedInsight = coachContextBriefService.pickInsightForCandidate({
        candidate: candidate as any,
        brief,
      });
      candidate.context += coachContextBriefService.formatSelectedInsight(selectedInsight);
    }

    if (dry_run) {
      return {
        userId: user.id,
        username: user.username,
        action: "skipped",
        reason: candidate
          ? `Dry run. Would send ${candidate.type}: ${candidate.reason}`
          : "Dry run. No eligible intervention",
      };
    }

    if (!candidate) {
      return {
        userId: user.id,
        username: user.username,
        action: "skipped",
        reason: "No eligible intervention",
      };
    }

    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { triggerAt: "asc" },
    });

    if (candidate.usesAgent) {
      const aiResponse = await coachAgentService.generateResponse({
        user,
        message: this.buildAgentInterventionPrompt(candidate),
        conversationHistory: recentMessages
          .slice(0, 8)
          .reverse()
          .map((m) => ({ role: m.role === "USER" ? "user" as const : "assistant" as const, content: m.content })),
        plans: user.plans,
        reminders,
      });

      if (aiResponse.skipped || aiResponse.draftMessages.length === 0) {
        if (fallbackCheckin) {
          const fallbackCandidate: CoachInterventionCandidate = {
            type: "INACTIVITY_CHECKIN",
            reason: "User requested a coach assessment from the coach chat.",
            planIds: user.plans.map((plan) => plan.id),
            targetDate: format(new TZDate(now, user.timezone || "UTC"), "yyyy-MM-dd"),
            context: await this.buildContextSummary(user, now),
            usesAgent: false,
          };
          const generated = await aiService.generateCoachAssessmentInterventionMessage({
            user,
            interventionType: "INACTIVITY_CHECKIN",
            reason: fallbackCandidate.reason,
            context: fallbackCandidate.context,
          });
          const sent = await this.dispatchCoachDrafts(user, fallbackCandidate, [
            { content: generated.message },
          ], generated.title);

          return {
            userId: user.id,
            username: user.username,
            action: "sent",
            reason: "Sent manual coach assessment fallback",
            sentMessageIds: sent.messageIds,
            notificationId: sent.notificationId,
          };
        }

        return {
          userId: user.id,
          username: user.username,
          action: "agent_skipped",
          reason: aiResponse.skipReason || "Agent decided no outreach needed",
        };
      }

      const sent = await this.dispatchCoachDrafts(user, candidate, aiResponse.draftMessages);
      return {
        userId: user.id,
        username: user.username,
        action: "sent",
        reason: `Sent ${candidate.type}`,
        sentMessageIds: sent.messageIds,
        notificationId: sent.notificationId,
      };
    }

    const generated = await aiService.generateCoachAssessmentInterventionMessage({
      user,
      interventionType: candidate.type as
        | "WEEK_PREP"
        | "SESSION_PREP"
        | "WEEK_RECAP"
        | "INACTIVITY_CHECKIN"
        | "CELEBRATION",
      reason: candidate.reason,
      context: candidate.context,
    });

    const sent = await this.dispatchCoachDrafts(user, candidate, [
      { content: generated.message },
    ], generated.title);

    return {
      userId: user.id,
      username: user.username,
      action: "sent",
      reason: `Sent ${candidate.type}`,
      sentMessageIds: sent.messageIds,
      notificationId: sent.notificationId,
    };
  }

  private buildAgentInterventionPrompt(candidate: CoachInterventionCandidate): string {
    const action =
      candidate.type === "INACTIVITY_ARCHIVE_PROPOSAL"
        ? "propose archiving the inactive plan with a single archive operation"
        : candidate.type === "INACTIVITY_PAUSE_PROPOSAL"
          ? "propose pausing the inactive plan with a single pause operation"
          : "propose a realistic plan adjustment for the user's missed or at-risk sessions";

    return dedent`
      You are doing proactive coach assessment. The system selected this intervention:
      ${candidate.type}

      Reason:
      ${candidate.reason}

      Context:
      ${candidate.context}

      Required action:
      - ${action}.
      - Use the available plan modification tool when proposing changes.
      - Mention that the user has 48 hours to decline before it applies automatically.
      - Use at most one personal insight from the coach context brief, and only if it makes the proposal clearer.
      - When saying the user logged, did, trained, or practiced something recently/lately, rely only on explicit recent activity logs in the context or readActivities output. Active plans are not recent activity evidence.
      - Default to 1-2 short messages. Keep each message to 1-2 short sentences.
      - Sound natural, like a sharp friend texting. Avoid stacked critiques and coaching jargon.
    `;
  }

  private async dispatchCoachDrafts(
    user: User,
    candidate: CoachInterventionCandidate,
    drafts: Array<{
      content: string;
      planReplacements?: Array<{ textToReplace: string; planGoal: string }>;
      planProposals?: Array<{
        planId: string;
        planGoal: string;
        planEmoji: string | null;
        description: string;
        operations: unknown[];
        status: null;
      }>;
      planCreationProposals?: Array<{
        goal: string;
        goalReason: string | null;
        emoji: string | null;
        timesPerWeek: number | null;
        activities: Array<{ title: string; measure: string; emoji: string; kind?: string | null }>;
        description: string;
        status: null;
      }>;
      activityLogProposals?: Array<{
        activityId: string;
        activityName: string;
        activityEmoji: string;
        activityMeasure: string;
        quantity: number;
        date: string;
        status: null;
      }>;
      toolCalls?: Array<{ tool: string; args: unknown; result: unknown }>;
    }>,
    notificationTitle?: string
  ): Promise<{ messageIds: string[]; notificationId?: string }> {
    const { chat } = await this.ensureCoachChat(user);
    const messageIds: string[] = [];

    for (const draft of drafts) {
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: "COACH",
          content: draft.content,
          metadata: JSON.parse(
            JSON.stringify({
              source: AUTONOMOUS_PROMPT_TAG,
              interventionType: candidate.type,
              targetDate: candidate.targetDate,
              targetWeekStart: candidate.targetWeekStart,
              planIds: candidate.planIds,
              sessionIds: candidate.sessionIds || [],
              planReplacements: draft.planReplacements || [],
              planProposals: draft.planProposals || [],
              planCreationProposals: draft.planCreationProposals || [],
              activityLogProposals: draft.activityLogProposals || [],
              ...(draft.toolCalls && { toolCalls: draft.toolCalls }),
            })
          ),
        },
      });
      messageIds.push(message.id);
    }

    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    const hasProposal = drafts.some(
      (d) => (d.planProposals && d.planProposals.length > 0) || (d.activityLogProposals && d.activityLogProposals.length > 0)
        || (d.planCreationProposals && d.planCreationProposals.length > 0)
    );
    const pendingActionCount = drafts.reduce(
      (count, draft) =>
        count +
        (draft.planProposals?.filter((proposal) => !proposal.status).length || 0) +
        (draft.planCreationProposals?.filter((proposal) => !proposal.status).length || 0) +
        (draft.activityLogProposals?.filter((proposal) => !proposal.status).length || 0),
      0
    );

    const notification = await notificationService.createAndProcessNotification(
      {
        userId: user.id,
        title: notificationTitle || this.getNotificationTitle(candidate.type, hasProposal),
        message: drafts[0]?.content?.substring(0, 200) || "",
        type: "COACH",
        relatedId: chat.id,
        promptTag: AUTONOMOUS_PROMPT_TAG,
        relatedData: {
          type: "COACH_ASSESSMENT",
          interventionType: candidate.type,
          targetDate: candidate.targetDate,
          targetWeekStart: candidate.targetWeekStart,
          planIds: candidate.planIds,
          sessionIds: candidate.sessionIds || [],
          messageIds,
          pendingActionCount,
        },
      },
      true
    );

    return { messageIds, notificationId: notification?.id };
  }

  private getNotificationTitle(type: CoachInterventionType, hasProposal: boolean): string {
    if (hasProposal) return "Plan adjustment";
    const titles: Record<CoachInterventionType, string> = {
      INACTIVITY_ARCHIVE_PROPOSAL: "Plan archive suggestion",
      INACTIVITY_PAUSE_PROPOSAL: "Plan pause suggestion",
      PLAN_ADJUSTMENT: "Plan adjustment",
      COACH_SETUP: "Coach setup",
      WEEK_PREP: "Week prep",
      SESSION_PREP: "Tomorrow's session",
      WEEK_RECAP: "Weekly recap",
      INACTIVITY_CHECKIN: "Coach check-in",
      CELEBRATION: "Nice work",
      STATUS_REVIEW: "Coach assessment",
    };
    return titles[type];
  }

  private async buildInterventionCandidates(
    user: CoachUser,
    now: Date,
    options: { force: boolean; pendingProposalExists: boolean; fallbackCheckin?: boolean }
  ): Promise<CoachInterventionCandidate[]> {
    const timezone = user.timezone || "UTC";
    const nowInTz = new TZDate(now, timezone);
    const localHour = nowInTz.getHours();
    const localDay = nowInTz.getDay();
    const currentWeekStart = startOfWeek(nowInTz, { weekStartsOn: 1 });
    const currentWeekEnd = endOfWeek(nowInTz, { weekStartsOn: 1 });
    const currentWeekStartKey = format(currentWeekStart, "yyyy-MM-dd");
    const candidates: CoachInterventionCandidate[] = [];

    const planSummaries = await Promise.all(
      user.plans.map((plan) => this.buildPlanAssessmentSummary(user, plan, now))
    );

    for (const summary of planSummaries) {
      const baseContext = summary.context;

      if (summary.daysSinceLastActivity !== null && summary.daysSinceLastActivity >= 30) {
        candidates.push({
          type: "INACTIVITY_ARCHIVE_PROPOSAL",
          reason: `${summary.plan.goal} has been inactive for ${summary.daysSinceLastActivity} days.`,
          planIds: [summary.plan.id],
          targetWeekStart: currentWeekStartKey,
          context: baseContext,
          usesAgent: true,
        });
      } else if (summary.daysSinceLastActivity !== null && summary.daysSinceLastActivity >= 14) {
        candidates.push({
          type: "INACTIVITY_PAUSE_PROPOSAL",
          reason: `${summary.plan.goal} has been inactive for ${summary.daysSinceLastActivity} days.`,
          planIds: [summary.plan.id],
          targetWeekStart: currentWeekStartKey,
          context: baseContext,
          usesAgent: true,
        });
      }

      if (
        !options.pendingProposalExists &&
        (summary.missedSessionsThisWeek >= 3 ||
          ["AT_RISK", "FAILED"].includes(summary.plan.currentWeekState || ""))
      ) {
        candidates.push({
          type: "PLAN_ADJUSTMENT",
          reason: `${summary.plan.goal} is ${summary.plan.currentWeekState || "missing sessions"} with ${summary.missedSessionsThisWeek} missed sessions this week.`,
          planIds: [summary.plan.id],
          targetWeekStart: currentWeekStartKey,
          context: baseContext,
          usesAgent: true,
        });
      }

      if (summary.daysSinceLastActivity !== null && summary.daysSinceLastActivity >= 7 && summary.daysSinceLastActivity < 14) {
        candidates.push({
          type: "INACTIVITY_CHECKIN",
          reason: `${summary.plan.goal} has had no activity for ${summary.daysSinceLastActivity} days.`,
          planIds: [summary.plan.id],
          targetWeekStart: currentWeekStartKey,
          context: baseContext,
          usesAgent: false,
        });
      }

      if (summary.totalSessionsThisWeek > 0 && summary.missedSessionsThisWeek === 0 && summary.completedSessionsThisWeek === summary.totalSessionsThisWeek) {
        candidates.push({
          type: "CELEBRATION",
          reason: `${summary.plan.goal} has all planned sessions completed this week.`,
          planIds: [summary.plan.id],
          targetWeekStart: currentWeekStartKey,
          context: baseContext,
          usesAgent: false,
        });
      }
    }

    if (options.force || this.isWeekPrepTime(user, now)) {
      const targetWeekStart = startOfWeek(localDay === 0 ? addDays(nowInTz, 1) : nowInTz, { weekStartsOn: 1 });
      const targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 1 });
      const weekSessions = this.getSessionsBetween(user.plans, targetWeekStart, targetWeekEnd);
      if (weekSessions.length > 0) {
        candidates.push({
          type: "WEEK_PREP",
          reason: `User has ${weekSessions.length} coached session${weekSessions.length === 1 ? "" : "s"} planned for the coming week.`,
          planIds: Array.from(new Set(weekSessions.map((s) => s.plan.id))),
          sessionIds: weekSessions.map((s) => s.session.id),
          targetWeekStart: format(targetWeekStart, "yyyy-MM-dd"),
          context: this.buildSessionContext("Upcoming week", weekSessions),
          usesAgent: false,
        });
      }
    }

    if (options.force || localHour === 20) {
      const tomorrow = addDays(nowInTz, 1);
      const tomorrowSessions = this.getSessionsBetween(user.plans, startOfDay(tomorrow), endOfDay(tomorrow));
      if (tomorrowSessions.length > 0) {
        candidates.push({
          type: "SESSION_PREP",
          reason: `User has ${tomorrowSessions.length} coached session${tomorrowSessions.length === 1 ? "" : "s"} planned tomorrow.`,
          planIds: Array.from(new Set(tomorrowSessions.map((s) => s.plan.id))),
          sessionIds: tomorrowSessions.map((s) => s.session.id),
          targetDate: format(tomorrow, "yyyy-MM-dd"),
          context: this.buildSessionContext("Tomorrow", tomorrowSessions),
          usesAgent: false,
        });
      }
    }

    if ((options.force || localDay === 1) && isWithinPreferredCoachWindow(user, now)) {
      const previousWeekStart = startOfWeek(subDays(nowInTz, 7), { weekStartsOn: 1 });
      const previousWeekEnd = endOfWeek(previousWeekStart, { weekStartsOn: 1 });
      const activePlanIds = user.plans.map((p) => p.id);
      const activityIds = user.plans.flatMap((p) => p.activities.map((a) => a.id));
      const entries = activityIds.length > 0
        ? await prisma.activityEntry.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              activityId: { in: activityIds },
              datetime: { gte: previousWeekStart, lte: previousWeekEnd },
            },
            include: { activity: true },
          })
        : [];
      if (entries.length > 0) {
        candidates.push({
          type: "WEEK_RECAP",
          reason: `User logged ${entries.length} activit${entries.length === 1 ? "y" : "ies"} last week.`,
          planIds: activePlanIds,
          targetWeekStart: format(previousWeekStart, "yyyy-MM-dd"),
          context: [
            `Previous week: ${format(previousWeekStart, "yyyy-MM-dd")} to ${format(previousWeekEnd, "yyyy-MM-dd")}`,
            `Logged activities: ${entries
              .map((e) => e.activity ? `${e.activity.emoji} ${e.activity.title}` : null)
              .filter(Boolean)
              .join(", ")}`,
          ].join("\n"),
          usesAgent: false,
        });
      }
    }

    if (options.force && options.fallbackCheckin && candidates.length === 0) {
      candidates.push({
        type: "INACTIVITY_CHECKIN",
        reason: "User requested a coach assessment from the coach chat.",
        planIds: user.plans.map((plan) => plan.id),
        targetDate: format(nowInTz, "yyyy-MM-dd"),
        context: await this.buildContextSummary(user, now),
        usesAgent: false,
      });
    }

    return candidates;
  }

  private async selectInterventionCandidate(
    user: User,
    candidates: CoachInterventionCandidate[],
    options: { bypassDuplicateCheck?: boolean } = {}
  ): Promise<CoachInterventionCandidate | null> {
    for (const type of INTERVENTION_PRIORITY) {
      const matching = candidates.filter((candidate) => candidate.type === type);
      for (const candidate of matching) {
        if (options.bypassDuplicateCheck) return candidate;
        const sent = await this.hasSentIntervention(user.id, candidate);
        if (!sent) return candidate;
      }
    }
    return null;
  }

  private async hasSentIntervention(userId: string, candidate: CoachInterventionCandidate): Promise<boolean> {
    const where: any = {
      userId,
      type: "COACH",
      promptTag: AUTONOMOUS_PROMPT_TAG,
      relatedData: {
        path: ["interventionType"],
        equals: candidate.type,
      },
    };

    const existing = await prisma.notification.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (!existing) return false;
    const relatedData = existing.relatedData as any;
    if (candidate.targetDate) {
      return relatedData?.targetDate === candidate.targetDate;
    }
    if (candidate.targetWeekStart) {
      return relatedData?.targetWeekStart === candidate.targetWeekStart;
    }
    return false;
  }

  private isWeekPrepTime(user: User, now: Date): boolean {
    const timezone = user.timezone || "UTC";
    const nowInTz = new TZDate(now, timezone);
    const localDay = nowInTz.getDay();
    const localHour = nowInTz.getHours();
    const preferredStartHour = user.preferredCoachingHour ?? 6;
    return (localDay === 0 && localHour === 20) || (localDay === 1 && localHour === preferredStartHour);
  }

  private getSessionsBetween(
    plans: CoachPlan[],
    start: Date,
    end: Date
  ): Array<{ plan: CoachPlan; session: PlanSession; activity: Activity }> {
    return plans.flatMap((plan) =>
      plan.sessions
        .filter((session) => session.date >= start && session.date <= end)
        .map((session) => ({
          plan,
          session,
          activity: plan.activities.find((activity) => activity.id === session.activityId)!,
        }))
        .filter((item) => item.activity)
    );
  }

  private buildSessionContext(
    label: string,
    sessions: Array<{ plan: CoachPlan; session: PlanSession; activity: Activity }>
  ): string {
    const lines = [`${label} sessions:`];
    for (const item of sessions) {
      lines.push(
        `- ${format(item.session.date, "yyyy-MM-dd")}: ${item.activity.emoji} ${item.activity.title} (${item.session.quantity} ${item.activity.measure}) for plan "${item.plan.goal}". Guide: ${item.session.descriptiveGuide || "none"}`
      );
    }
    return lines.join("\n");
  }

  private async buildPlanAssessmentSummary(user: User, plan: CoachPlan, now: Date) {
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);
    const activityIds = plan.activities.map((a) => a.id);
    const entries = activityIds.length > 0
      ? await prisma.activityEntry.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            activityId: { in: activityIds },
            datetime: { gte: ninetyDaysAgo, lte: now },
          },
          orderBy: { datetime: "desc" },
        })
      : [];

    const lastEntry = entries[0];
    const daysSinceLastActivity = lastEntry
      ? differenceInCalendarDays(now, lastEntry.datetime)
      : null;
    const sessionsThisWeek = plan.sessions.filter(
      (s) => s.date >= startOfDay(sevenDaysAgo) && s.date < startOfDay(now)
    );
    const completedSessionsThisWeek = sessionsThisWeek.filter((session) =>
      entries.some(
        (entry) =>
          entry.activityId === session.activityId &&
          isSameDay(entry.datetime, session.date)
      )
    ).length;
    const missedSessionsThisWeek = sessionsThisWeek.length - completedSessionsThisWeek;
    const entriesLast7Days = entries.filter((e) => e.datetime >= sevenDaysAgo).length;
    const entriesLast30Days = entries.filter((e) => e.datetime >= thirtyDaysAgo).length;

    const context = [
      `Plan: ${plan.emoji || ""} ${plan.goal}`,
      `Current week state: ${plan.currentWeekState || "unknown"}`,
      `Last activity: ${daysSinceLastActivity !== null ? `${daysSinceLastActivity} days ago` : "never"}`,
      `Entries last 7 days: ${entriesLast7Days}`,
      `Entries last 30 days: ${entriesLast30Days}`,
      `Recent sessions: ${completedSessionsThisWeek}/${sessionsThisWeek.length} completed, ${missedSessionsThisWeek} missed`,
    ].join("\n");

    return {
      plan,
      daysSinceLastActivity,
      totalSessionsThisWeek: sessionsThisWeek.length,
      completedSessionsThisWeek,
      missedSessionsThisWeek,
      context,
    };
  }

  private async buildContextSummary(user: CoachUser, now: Date): Promise<string> {
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);
    const userDayOfWeek = new TZDate(now, user.timezone || "UTC").getDay();
    const lines: string[] = [];
    const recentEntries = await prisma.activityEntry.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        activityId: { not: null },
        activity: { deletedAt: null },
        datetime: { gte: thirtyDaysAgo, lte: now },
      },
      include: {
        activity: { select: { title: true, emoji: true, measure: true } },
      },
      orderBy: { datetime: "desc" },
      take: 12,
    });

    lines.push(`Today: ${format(now, "yyyy-MM-dd (EEEE)")}`);
    lines.push(`Day of week: ${userDayOfWeek === 1 ? "Monday (recap day)" : format(now, "EEEE")}`);
    lines.push("Grounding rule: Only activities listed under recent activity logs may be described as logged recently/lately. Active plans alone are not activity history.");
    lines.push(
      recentEntries.length > 0
        ? `Recent activity logs last 30 days: ${recentEntries
            .map((entry) =>
              entry.activity
                ? `${format(entry.datetime, "yyyy-MM-dd")} ${entry.activity.emoji} ${entry.activity.title}`
                : null
            )
            .filter(Boolean)
            .join("; ")}`
        : "Recent activity logs last 30 days: none"
    );
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

  private async getRecentCoachMessages(userId: string): Promise<Message[]> {
    const chats = await prisma.chat.findMany({
      where: { userId, type: "COACH" },
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
      const coachPersonality = getCoachPersonalityConfig(user.coachPersonality);
      coach = await prisma.coach.create({
        data: {
          ownerId: user.id,
          details: {
            name: coachPersonality.displayName,
            bio: `Your personal AI coach helping you achieve your goals as ${coachPersonality.title}.`,
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
        data: { userId: user.id, coachId: coach.id, title: null },
      });
    }

    return { coach, chat };
  }
}

export const coachAssessmentService = new CoachAssessmentService();
