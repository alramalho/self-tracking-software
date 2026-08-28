import { TZDate } from "@date-fns/tz";
import {
  Activity,
  Message,
  Plan,
  PlanMilestone,
  PlanSession,
  User,
} from "@tsw/prisma";
import {
  buildPlanWeekProjection,
  type PlanWeekSummary,
} from "@tsw/prisma/plan-week";
import {
  addDays,
  differenceInCalendarDays,
  differenceInHours,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";
import dedent from "dedent";
import {
  getCoachWeekBounds,
  getPreviousCoachWeekBounds,
} from "../../../utils/date";
import { logger } from "../../../utils/logger";
import { prisma } from "../../../utils/prisma";
import {
  COACH_GENERATION_ERROR_MESSAGE,
  coachAgentService,
} from "../agent";
import type { CoachDraftMessage } from "../types";
import { resolveAutonomousCoachAgentModel } from "../../coachAgentModelConfig";
import {
  deriveCoachAttentionItems,
  formatCoachAttentionContext,
  type CoachAttentionItem,
} from "../../coachAttentionService";
import {
  buildCoachContextBrief,
  formatSelectedInsight,
  pickInsightForCandidate,
} from "./contextBrief";
import { getCoachPersonalityConfig } from "../../coachPersonalityService";
import { notificationService } from "../../notificationService";
import { cancelPendingPlanCreationProposals } from "../../planCreationProposalStatusService";
import {
  executePlanProposalPatch,
  getProposalPatch,
  PlanProposalPatch,
} from "../../planProposalPatchService";
import {
  buildRecurrentCoachAssessmentPrompt,
  type RecurrentCoachAssessmentInterventionType,
} from "./prompt";
import {
  buildAssessmentWeeklyOverview,
  buildWeeklyReviewOverview,
} from "./weeklyOverview";
import {
  coachDefersWeekContent,
  daysSinceExternalAgentSync,
  getExternalAgentPresenceTier,
  isExternalAgentManaged,
  readExternalAgentStatusFile,
  truncateStatusForContext,
} from "../externalAgentPresence";

type CoachPlan = Plan & {
  activities: Activity[];
  sessions: PlanSession[];
  milestones: PlanMilestone[];
};
type CoachUser = User & { plans: CoachPlan[] };

interface RunOptions {
  filter_usernames?: string[];
  dry_run?: boolean;
  force?: boolean;
  now?: Date;
}

interface AssessOptions
  extends Required<Pick<RunOptions, "dry_run" | "force" | "now">> {
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

// Staged rollout: autonomous coaching only runs for these usernames.
// Set AUTONOMOUS_COACH_USERNAMES to a comma-separated list, or "*" for everyone.
export function getAutonomousCoachUsernameAllowlist(): string[] | null {
  const raw = process.env.AUTONOMOUS_COACH_USERNAMES ?? "alex";
  const usernames = raw
    .split(",")
    .map((username) => username.trim())
    .filter(Boolean);
  if (usernames.includes("*")) return null;
  return usernames;
}

export function resolveAutonomousCoachUsernameFilter(
  allowlist: string[] | null,
  filterUsernames: string[],
): string[] | null {
  if (!allowlist) return filterUsernames.length > 0 ? filterUsernames : null;
  if (filterUsernames.length === 0) return allowlist;
  return filterUsernames.filter((username) => allowlist.includes(username));
}
const AUTO_ACCEPT_HOURS = 48;
const MILESTONE_AUTO_ACCEPT_NOTE =
  "Milestone changes require explicit user confirmation";
const AGENT_MANAGED_AUTO_ACCEPT_NOTE =
  "A connected agent plans this plan's weeks; accept or reject explicitly";
const PLAN_ATTENTION_FOLLOW_UP_DELAYS_HOURS = [24, 48];
const PLAN_ATTENTION_ARCHIVE_AFTER_HOURS = 7 * 24;
const PLAN_ATTENTION_ARCHIVE_MIN_NOTIFICATIONS = 3;

function patchContainsMilestoneChanges(patch: PlanProposalPatch): boolean {
  return !!(
    patch.milestones?.upsert?.length || patch.milestones?.deleteIds?.length
  );
}

type CoachInterventionType =
  | "INACTIVITY_ARCHIVE_PROPOSAL"
  | "PLAN_ATTENTION_ARCHIVED"
  | "INACTIVITY_PAUSE_PROPOSAL"
  | "PLAN_ATTENTION"
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
  attentionItems?: CoachAttentionItem[];
  escalationCount?: number;
};

export class CoachAssessmentRetryError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const INTERVENTION_PRIORITY: CoachInterventionType[] = [
  "INACTIVITY_ARCHIVE_PROPOSAL",
  "PLAN_ATTENTION_ARCHIVED",
  "INACTIVITY_PAUSE_PROPOSAL",
  "PLAN_ATTENTION",
  "PLAN_ADJUSTMENT",
  "WEEK_PREP",
  "SESSION_PREP",
  "WEEK_RECAP",
  "INACTIVITY_CHECKIN",
  "CELEBRATION",
];
const COACH_INTERVENTION_TYPES = [
  ...INTERVENTION_PRIORITY,
  "COACH_SETUP",
  "STATUS_REVIEW",
] as const satisfies readonly CoachInterventionType[];

function isCoachInterventionType(value: unknown): value is CoachInterventionType {
  return (
    typeof value === "string" &&
    (COACH_INTERVENTION_TYPES as readonly string[]).includes(value)
  );
}

function isRecurrentCoachAssessmentIntervention(
  type: CoachInterventionType,
): type is RecurrentCoachAssessmentInterventionType {
  return (
    type === "WEEK_PREP" ||
    type === "SESSION_PREP" ||
    type === "WEEK_RECAP" ||
    type === "INACTIVITY_CHECKIN" ||
    type === "CELEBRATION"
  );
}

// Plans past their finishingDate stay included on purpose: the coach owns
// driving them to a decision (renew or archive) until they leave this state.
function activePlanWhere(_now: Date) {
  return {
    deletedAt: null,
    archivedAt: null,
    isPaused: false,
  };
}

export function isWithinPreferredCoachWindow(
  user: Pick<User, "timezone" | "preferredCoachingHour">,
  now: Date = new Date(),
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
    const activityEditProposals = metadata?.activityEditProposals || [];
    return [
      ...planProposals,
      ...activityLogProposals,
      ...activityEditProposals,
    ].some((proposal: any) => !proposal.status);
  });
}

export class CoachAssessmentService {
  async runAutonomousCoachAssessment(
    options: RunOptions = {},
  ): Promise<RunResult> {
    const environment =
      process.env.ENVIRONMENT || process.env.NODE_ENV || "development";
    const productionDefault = environment === "production";
    const {
      filter_usernames = [],
      force = false,
      now = new Date(),
    } = options;
    const dry_run =
      options.dry_run ??
      (process.env.AUTONOMOUS_COACH_DRY_RUN
        ? process.env.AUTONOMOUS_COACH_DRY_RUN !== "false"
        : !productionDefault);

    const enabled =
      force ||
      process.env.AUTONOMOUS_COACH_ENABLED === "true" ||
      (productionDefault && process.env.AUTONOMOUS_COACH_ENABLED !== "false");
    if (!enabled) {
      return {
        dry_run,
        enabled: false,
        users_checked: 0,
        messages_sent: 0,
        results: [],
      };
    }

    const usernameFilter = resolveAutonomousCoachUsernameFilter(
      getAutonomousCoachUsernameAllowlist(),
      filter_usernames,
    );
    if (usernameFilter && usernameFilter.length === 0) {
      return {
        dry_run,
        enabled: true,
        users_checked: 0,
        messages_sent: 0,
        results: [],
      };
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        planType: { not: "FREE" },
        proactiveCoachingEnabled: true,
        ...(usernameFilter ? { username: { in: usernameFilter } } : {}),
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
          include: { activities: true, sessions: true, milestones: true },
        },
      },
    });

    const results: UserAssessmentResult[] = [];

    for (const user of users as CoachUser[]) {
      try {
        const result = await this.assessUser(user, { dry_run, force, now });
        results.push(result);
      } catch (error) {
        logger.error(
          `Autonomous coach assessment failed for ${user.username}:`,
          error,
        );
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
    options: { now?: Date } = {},
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
          include: { activities: true, sessions: true, milestones: true },
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
    const attentionItems = deriveCoachAttentionItems({
      user,
      plans: coachUser.plans,
      now,
    });

    const aiResponse = await coachAgentService.generateResponse({
      model: resolveAutonomousCoachAgentModel(),
      user,
      message: this.buildStatusReviewPrompt(attentionItems),
      conversationHistory: [],
      plans: coachUser.plans,
    });

    logger.info(
      `[coach-assessment] manual status review user=${user.username} plans=${coachUser.plans.length} drafts=${aiResponse.draftMessages.length} skipped=${aiResponse.skipped}`,
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
      context: formatCoachAttentionContext(attentionItems),
      usesAgent: true,
      attentionItems,
    };

    const sent = await this.dispatchCoachDrafts(
      user,
      candidate,
      aiResponse.draftMessages,
      "Coach assessment",
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

  async retryCoachAssessmentMessageForUser(userId: string, messageId: string) {
    const existingMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        role: "COACH",
        chat: {
          userId,
          type: "COACH",
        },
      },
      include: { feedback: true },
    });

    if (!existingMessage) {
      throw new CoachAssessmentRetryError(404, "Coach message not found");
    }

    const metadata =
      existingMessage.metadata && typeof existingMessage.metadata === "object"
        ? (existingMessage.metadata as Record<string, any>)
        : {};

    if (!this.isRetryableCoachGenerationError(existingMessage, metadata)) {
      throw new CoachAssessmentRetryError(
        409,
        "Coach message is not retryable",
      );
    }

    const referenceNow = existingMessage.createdAt;
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        plans: {
          where: {
            ...activePlanWhere(referenceNow),
          },
          include: { activities: true, sessions: true, milestones: true },
        },
      },
    });

    if (!user) {
      throw new CoachAssessmentRetryError(404, "User not found");
    }

    const coachUser = user as CoachUser;
    const candidate = await this.buildRetryCandidateFromMessage(
      coachUser,
      metadata,
      referenceNow,
    );
    const recentMessages = (await this.getRecentCoachMessages(user.id))
      .filter(
        (message) =>
          message.id !== existingMessage.id &&
          message.createdAt < existingMessage.createdAt,
      )
      .slice(0, 8);
    const prompt =
      candidate.type === "STATUS_REVIEW"
        ? this.buildStatusReviewPrompt(candidate.attentionItems || [])
        : isRecurrentCoachAssessmentIntervention(candidate.type)
          ? buildRecurrentCoachAssessmentPrompt({
              interventionType: candidate.type,
              reason: candidate.reason,
              context: candidate.context,
            })
          : this.buildAgentInterventionPrompt(candidate);

    const aiResponse = await coachAgentService.generateResponse({
      model: resolveAutonomousCoachAgentModel(),
      user,
      message: prompt,
      conversationHistory:
        candidate.type === "STATUS_REVIEW"
          ? []
          : recentMessages.reverse().map((message) => ({
              role:
                message.role === "USER"
                  ? ("user" as const)
                  : ("assistant" as const),
              content: message.content,
            })),
      plans: coachUser.plans,
    });

    const retryCount = Number(metadata.retryCount || 0) + 1;
    const failedDraft = aiResponse.draftMessages.find((draft) => draft.error);
    if (aiResponse.skipped || aiResponse.draftMessages.length === 0 || failedDraft) {
      const failedMetadata = this.buildCoachAssessmentMessageMetadata(
        candidate,
        {
          content: existingMessage.content,
          error: true,
        },
        {
          error: true,
          coachGenerationStatus: "error",
          retryable: true,
          retryCount,
          originalErrorContent:
            metadata.originalErrorContent || existingMessage.content,
          lastRetryFailedAt: new Date().toISOString(),
          lastRetryReason:
            aiResponse.skipReason ||
            (failedDraft ? "Coach generation failed again" : "Agent produced no assessment"),
        },
      );
      const updatedMessage = await prisma.message.update({
        where: { id: existingMessage.id },
        data: { metadata: failedMetadata },
        include: { feedback: true },
      });

      return {
        retried: false,
        message: this.serializeCoachAssessmentMessage(updatedMessage, coachUser.plans),
      };
    }

    const combinedDraft = this.combineCoachDrafts(aiResponse.draftMessages);
    const successMetadata = this.buildCoachAssessmentMessageMetadata(
      candidate,
      combinedDraft,
      {
        error: false,
        coachGenerationStatus: "retried_success",
        retryable: false,
        retryCount,
        retriedAt: new Date().toISOString(),
        originalErrorContent:
          metadata.originalErrorContent || existingMessage.content,
      },
    );
    const updatedMessage = await prisma.message.update({
      where: { id: existingMessage.id },
      data: {
        content: combinedDraft.content,
        metadata: successMetadata,
      },
      include: { feedback: true },
    });

    if ((combinedDraft.planCreationProposals?.length || 0) > 0) {
      await cancelPendingPlanCreationProposals(
        updatedMessage.chatId,
        [updatedMessage.id],
      );
    }

    await prisma.chat.update({
      where: { id: updatedMessage.chatId },
      data: { updatedAt: new Date() },
    });

    return {
      retried: true,
      message: this.serializeCoachAssessmentMessage(updatedMessage, coachUser.plans),
    };
  }

  private isRetryableCoachGenerationError(
    message: Pick<Message, "content" | "role">,
    metadata: Record<string, any>,
  ) {
    if (message.role !== "COACH") return false;
    if (metadata.source !== AUTONOMOUS_PROMPT_TAG) return false;
    if (metadata.coachGenerationStatus === "retried_success") return false;

    return (
      metadata.error === true ||
      metadata.coachGenerationStatus === "error" ||
      message.content === COACH_GENERATION_ERROR_MESSAGE
    );
  }

  private async buildRetryCandidateFromMessage(
    user: CoachUser,
    metadata: Record<string, any>,
    referenceNow: Date,
  ): Promise<CoachInterventionCandidate> {
    const interventionType = metadata.interventionType;
    if (!isCoachInterventionType(interventionType)) {
      throw new CoachAssessmentRetryError(
        409,
        "Coach message has no retryable assessment type",
      );
    }

    const planIds = Array.isArray(metadata.planIds)
      ? metadata.planIds.filter((id: unknown): id is string => typeof id === "string")
      : user.plans.map((plan) => plan.id);
    const attentionItems = Array.isArray(metadata.coachAttentionItems)
      ? metadata.coachAttentionItems
      : deriveCoachAttentionItems({
          user,
          plans: user.plans,
          now: referenceNow,
        });

    if (interventionType === "STATUS_REVIEW") {
      return {
        type: "STATUS_REVIEW",
        reason: "Retrying a failed coach assessment.",
        planIds,
        context: formatCoachAttentionContext(attentionItems),
        usesAgent: true,
        attentionItems,
      };
    }

    const candidates = await this.buildInterventionCandidates(user, referenceNow, {
      force: true,
      pendingProposalExists: false,
      fallbackCheckin: true,
    });
    const matchingCandidate = candidates.find(
      (candidate) =>
        candidate.type === interventionType &&
        this.retryCandidateMatchesMetadata(candidate, metadata),
    );
    if (matchingCandidate) return matchingCandidate;

    return {
      type: interventionType,
      reason: "Retrying a failed proactive coach assessment.",
      planIds,
      sessionIds: Array.isArray(metadata.sessionIds)
        ? metadata.sessionIds.filter(
            (id: unknown): id is string => typeof id === "string",
          )
        : [],
      targetDate:
        typeof metadata.targetDate === "string" ? metadata.targetDate : undefined,
      targetWeekStart:
        typeof metadata.targetWeekStart === "string"
          ? metadata.targetWeekStart
          : undefined,
      context: await this.buildContextSummary(user, referenceNow),
      usesAgent: true,
      attentionItems,
      escalationCount:
        typeof metadata.escalationCount === "number"
          ? metadata.escalationCount
          : 0,
    };
  }

  private retryCandidateMatchesMetadata(
    candidate: CoachInterventionCandidate,
    metadata: Record<string, any>,
  ) {
    if (
      typeof metadata.targetDate === "string" &&
      candidate.targetDate !== metadata.targetDate
    ) {
      return false;
    }

    if (
      typeof metadata.targetWeekStart === "string" &&
      candidate.targetWeekStart !== metadata.targetWeekStart
    ) {
      return false;
    }

    const planIds = Array.isArray(metadata.planIds)
      ? metadata.planIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (
      planIds.length > 0 &&
      !candidate.planIds.some((planId) => planIds.includes(planId))
    ) {
      return false;
    }

    return true;
  }

  private combineCoachDrafts(drafts: CoachDraftMessage[]): CoachDraftMessage {
    const collect = <K extends keyof CoachDraftMessage>(key: K) =>
      drafts.flatMap((draft) => {
        const value = draft[key];
        return Array.isArray(value) ? value : [];
      });

    return {
      content: drafts
        .map((draft) => draft.content.trim())
        .filter(Boolean)
        .join("\n\n"),
      planReplacements: collect("planReplacements"),
      planProposals: collect("planProposals"),
      planCreationProposals: collect("planCreationProposals"),
      activityLogProposals: collect("activityLogProposals"),
      activityEditProposals: collect("activityEditProposals"),
      userContextEventProposals: collect("userContextEventProposals"),
      toolCalls: collect("toolCalls"),
    };
  }

  private buildCoachAssessmentMessageMetadata(
    candidate: CoachInterventionCandidate,
    draft: CoachDraftMessage,
    overrides: Record<string, unknown> = {},
  ) {
    const isGenerationError = draft.error === true;

    return JSON.parse(
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
        activityEditProposals: draft.activityEditProposals || [],
        userContextEventProposals: draft.userContextEventProposals || [],
        coachAttentionItems: candidate.attentionItems || [],
        escalationCount: candidate.escalationCount || 0,
        error: isGenerationError,
        coachGenerationStatus: isGenerationError ? "error" : "ok",
        retryable: isGenerationError,
        retryCount: 0,
        ...(draft.toolCalls && { toolCalls: draft.toolCalls }),
        ...overrides,
      }),
    );
  }

  private serializeCoachAssessmentMessage(
    message: Message & { feedback?: unknown[] },
    plans: CoachPlan[],
  ) {
    const metadata =
      message.metadata && typeof message.metadata === "object"
        ? (message.metadata as Record<string, any>)
        : {};
    const isError = this.isRetryableCoachGenerationError(message, metadata);
    const planReplacements =
      metadata.planReplacements
        ?.map((replacement: any) => {
          const plan = plans.find(
            (candidatePlan) =>
              candidatePlan.goal.toLowerCase() ===
              replacement.planGoal?.toLowerCase(),
          );
          return plan
            ? {
                textToReplace: replacement.textToReplace,
                plan: {
                  id: plan.id,
                  goal: plan.goal,
                  emoji: plan.emoji,
                },
              }
            : null;
        })
        .filter(Boolean) || [];

    return {
      id: message.id,
      chatId: message.chatId,
      role: message.role,
      content: message.content,
      status: message.status,
      planReplacements,
      metricReplacement: null,
      planProposals: metadata.planProposals || [],
      planCreationProposals: metadata.planCreationProposals || [],
      activityLogProposals: metadata.activityLogProposals || [],
      activityEditProposals: metadata.activityEditProposals || [],
      userContextEventProposals: metadata.userContextEventProposals || [],
      coachAttentionItems: metadata.coachAttentionItems || [],
      toolCalls: metadata.toolCalls || null,
      error: isError,
      coachGenerationStatus:
        metadata.coachGenerationStatus || (isError ? "error" : undefined),
      retryable: metadata.retryable ?? isError,
      retryCount: metadata.retryCount || 0,
      source: metadata.source || null,
      createdAt: message.createdAt,
      feedback: message.feedback || [],
    };
  }

  private buildStatusReviewPrompt(
    attentionItems: CoachAttentionItem[] = [],
  ): string {
    const attentionContext = formatCoachAttentionContext(attentionItems);

    return dedent`
      You are doing an introductory status check-in with the user. This is a fresh
      assessment — do not treat it as a continuation of a prior conversation.

      ${attentionContext}

      Required:
      - Treat COACH ATTENTION ITEMS as the assessment agenda. If any critical item exists,
        lead with the highest-severity item.
      - Open with a brief read on where they stand across their active plans, using
        USER'S PLANS + RECENT ACTIVITY FACTS only.
      - Distinguish current week-to-date from the last fully completed week. Do not
        describe last-week zeros as current-week zeros when current-week logs exist.
      - For active SPECIFIC plans, cross-check current-week sessions, next-week
        sessions, future sessions, and recent linked entries.
      - If a SPECIFIC plan has no future sessions, call it a schedule setup gap,
        not proof the user failed the goal.
      - Give a one-line status-vs-goal take per meaningful plan (on track / slipping / strong).
      - Include one concrete next step only when the evidence calls for action.
      - Never ask "how did it go?", "how did it feel?", or another generic check-in
        question after a logged activity. Ask only when the answer is required to
        choose or apply a plan change.
      - Use one short message of at most 3 sentences. This message doubles as the
        coach summary on the home card, so put the current status first.
      - Sound direct and natural. No praise sandwich, motivational filler, or
        stacked critiques.
      - Don't invent activity the user hasn't logged. If a plan has no recent activity, say so plainly.
    `;
  }

  private async runCoachSetupCheckin(
    user: CoachUser,
    now: Date,
  ): Promise<UserAssessmentResult> {
    const recentMessages = await this.getRecentCoachMessages(user.id);

    const activePlanSummary =
      user.plans.length > 0
        ? user.plans
            .map(
              (plan) =>
                `- ${plan.emoji || ""} ${plan.goal}${plan.outlineType === "TIMES_PER_WEEK" && plan.timesPerWeek ? ` (${plan.timesPerWeek}x/week)` : ""}`,
            )
            .join("\n")
        : "No active plans.";

    const aiResponse = await coachAgentService.generateResponse({
      user,
      message: dedent`
        The user manually ran a coach assessment, but they have no active plans.

        This is a setup moment, not an error.

        Active plans:
        ${activePlanSummary}

        Required behavior:
        - Speak as the coach in first person. Do not say "No active coach plans".
        - Ask what measurable plan they want to create first.
        - Sound natural and conversational. Avoid corporate phrases like "To coach you effectively".
        - Do not use em dashes. Use commas, periods, or parentheses instead.
        - Ask at most one crisp question. Do not propose a setup tool until the user gives a concrete target or confirms what to change.
      `,
      conversationHistory: recentMessages
        .slice(0, 8)
        .reverse()
        .map((m) => ({
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
      plans: user.plans,
    });

    const candidate: CoachInterventionCandidate = {
      type: "COACH_SETUP",
      reason: "User requested a coach assessment without an active plan.",
      planIds: user.plans.map((plan) => plan.id),
      targetDate: format(new TZDate(now, user.timezone || "UTC"), "yyyy-MM-dd"),
      context: activePlanSummary,
      usesAgent: true,
    };

    const drafts =
      aiResponse.draftMessages.length > 0
        ? aiResponse.draftMessages
        : [
            {
              content:
                "I do not see an active plan yet. What measurable goal do you want to start with?",
            },
          ];

    const sent = await this.dispatchCoachDrafts(
      user,
      candidate,
      drafts,
      "Coach setup",
    );

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
      include: { chat: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    });

    let processed = 0;
    let accepted = 0;
    let errors = 0;

    const allowlist = getAutonomousCoachUsernameAllowlist();

    for (const message of messages) {
      if (message.chat.user?.proactiveCoachingEnabled === false) {
        logger.info(
          `Skipping auto-accept for coach message ${message.id} because proactive coaching is disabled`,
        );
        continue;
      }

      if (
        allowlist &&
        !allowlist.includes(message.chat.user?.username || "")
      ) {
        logger.info(
          `Skipping auto-accept for coach message ${message.id} because the user is outside the autonomous coach rollout`,
        );
        continue;
      }

      const metadata = message.metadata as any;
      const proposals: any[] = metadata?.planProposals || [];
      let changed = false;

      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        if (proposal.status) continue;
        if (proposal.autoAcceptNote === MILESTONE_AUTO_ACCEPT_NOTE) continue;
        if (proposal.autoAcceptNote === AGENT_MANAGED_AUTO_ACCEPT_NOTE) continue;

        processed++;
        changed = true;

        try {
          const plan = await prisma.plan.findFirst({
            where: { id: proposal.planId, deletedAt: null },
            include: { activities: true, sessions: true, milestones: true },
          });

          if (!plan) {
            proposals[i].status = "auto_accepted";
            proposals[i].autoAcceptNote = "Plan no longer exists";
            continue;
          }

          // Accept-time liveness check: never auto-apply a stale coach patch
          // on top of a schedule a live connected agent owns.
          if (coachDefersWeekContent(plan, now)) {
            proposals[i].autoAcceptNote = AGENT_MANAGED_AUTO_ACCEPT_NOTE;
            logger.info(
              `Skipped auto-accept for agent-managed plan "${plan.goal}"`,
            );
            continue;
          }

          const patch = getProposalPatch(proposal);
          if (patchContainsMilestoneChanges(patch)) {
            proposals[i].autoAcceptNote = MILESTONE_AUTO_ACCEPT_NOTE;
            logger.info(
              `Skipped auto-accept for milestone proposal "${proposal.description}" on plan "${plan.goal}"`,
            );
            continue;
          }

          await executePlanProposalPatch({
            planId: proposal.planId,
            patch,
          });
          proposals[i].status = "auto_accepted";
          proposals[i].autoAcceptedAt = now.toISOString();
          accepted++;

          logger.info(
            `Auto-accepted proposal "${proposal.description}" for plan "${plan.goal}" after ${AUTO_ACCEPT_HOURS}h`,
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

  private async assessUser(
    user: CoachUser,
    options: AssessOptions,
  ): Promise<UserAssessmentResult> {
    const {
      now,
      force,
      dry_run,
      bypassDuplicateCheck = false,
      fallbackCheckin = false,
    } = options;

    const recentMessages = await this.getRecentCoachMessages(user.id);
    const pendingProposalExists = hasPendingProposal(recentMessages);
    const rupturedAttentionItems = await this.findRupturedPlanAttentionItems(
      user,
      now,
    );
    if (rupturedAttentionItems.length > 0) {
      if (dry_run) {
        return {
          userId: user.id,
          username: user.username,
          action: "skipped",
          reason: `Dry run. Would archive ${rupturedAttentionItems.length} unresolved schedule gap${rupturedAttentionItems.length === 1 ? "" : "s"}`,
        };
      }

      const sent = await this.archiveRupturedPlanAttentionItems(
        user,
        rupturedAttentionItems,
        now,
      );
      return {
        userId: user.id,
        username: user.username,
        action: "sent",
        reason:
          "Archived unresolved scheduled plan after repeated coach nudges",
        sentMessageIds: sent.messageIds,
        notificationId: sent.notificationId,
      };
    }

    const candidates = await this.buildInterventionCandidates(user, now, {
      force,
      pendingProposalExists,
      fallbackCheckin,
    });
    const candidate = await this.selectInterventionCandidate(user, candidates, {
      bypassDuplicateCheck,
      now,
    });

    logger.info(
      `[coach-assessment] user=${user.username} historyMessages=${recentMessages.length} bypassDuplicateCheck=${bypassDuplicateCheck} candidates=[${candidates
        .map((c) => c.type)
        .join(",")}] selected=${candidate?.type ?? "none"}`,
    );

    if (candidate && candidate.type !== "COACH_SETUP") {
      const brief = await buildCoachContextBrief({
        user,
        plans: user.plans,
        now,
      });
      const selectedInsight = pickInsightForCandidate({
        candidate: candidate as any,
        brief,
      });
      candidate.context += formatSelectedInsight(selectedInsight);
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

    if (candidate.usesAgent) {
      const message = isRecurrentCoachAssessmentIntervention(candidate.type)
        ? buildRecurrentCoachAssessmentPrompt({
            interventionType: candidate.type,
            reason: candidate.reason,
            context: candidate.context,
          })
        : this.buildAgentInterventionPrompt(candidate);
      const aiResponse = await coachAgentService.generateResponse({
        model: resolveAutonomousCoachAgentModel(),
        user,
        message,
        conversationHistory: recentMessages
          .slice(0, 8)
          .reverse()
          .map((m) => ({
            role:
              m.role === "USER" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
        plans: user.plans,
      });

      if (aiResponse.skipped || aiResponse.draftMessages.length === 0) {
        if (fallbackCheckin) {
          const fallbackCandidate: CoachInterventionCandidate = {
            type: "INACTIVITY_CHECKIN",
            reason: "User requested a coach assessment from the coach chat.",
            planIds: user.plans.map((plan) => plan.id),
            targetDate: format(
              new TZDate(now, user.timezone || "UTC"),
              "yyyy-MM-dd",
            ),
            context: await this.buildContextSummary(user, now),
            usesAgent: true,
          };
          const fallbackResponse = await coachAgentService.generateResponse({
            model: resolveAutonomousCoachAgentModel(),
            user,
            message: buildRecurrentCoachAssessmentPrompt({
              interventionType: "INACTIVITY_CHECKIN",
              reason: fallbackCandidate.reason,
              context: fallbackCandidate.context,
            }),
            conversationHistory: recentMessages
              .slice(0, 8)
              .reverse()
              .map((m) => ({
                role:
                  m.role === "USER"
                    ? ("user" as const)
                    : ("assistant" as const),
                content: m.content,
              })),
            plans: user.plans,
          });
          const sent = await this.dispatchCoachDrafts(
            user,
            fallbackCandidate,
            [
              ...(fallbackResponse.draftMessages.length > 0
                ? fallbackResponse.draftMessages
                : [
                    {
                      content:
                        "Quick check-in, what would make the next small step feel doable today?",
                    },
                  ]),
            ],
            "Coach check-in",
          );

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

      const sent = await this.dispatchCoachDrafts(
        user,
        candidate,
        aiResponse.draftMessages,
      );
      return {
        userId: user.id,
        username: user.username,
        action: "sent",
        reason: `Sent ${candidate.type}`,
        sentMessageIds: sent.messageIds,
        notificationId: sent.notificationId,
      };
    }

    return {
      userId: user.id,
      username: user.username,
      action: "skipped",
      reason: `Unsupported non-agent intervention ${candidate.type}`,
    };
  }

  buildAgentInterventionPrompt(
    candidate: CoachInterventionCandidate,
  ): string {
    const onlyPastEndDateItems =
      (candidate.attentionItems?.length || 0) > 0 &&
      candidate.attentionItems!.every(
        (item) => item.kind === "PLAN_PAST_END_DATE",
      );
    const action =
      candidate.type === "INACTIVITY_ARCHIVE_PROPOSAL"
        ? "propose archiving the inactive plan with patch.archive"
        : candidate.type === "INACTIVITY_PAUSE_PROPOSAL"
          ? "propose pausing the inactive plan with a single pause operation"
          : candidate.type === "PLAN_ATTENTION"
            ? onlyPastEndDateItems
              ? "point out the plan is past its end date and ask whether it is done; if done propose archiving it with patch.archive, otherwise propose a new finishing date and the next useful steps"
              : "explain the schedule gap and ask whether the user wants you to repair or extend the affected plan schedule"
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
      - Use the available plan modification tool only when proposing concrete changes.
      - Mention the 48-hour auto-apply window only if a plan proposal is attached.
      - When proposing plan creation or updates, state what will be set immediately and what still needs setup: times/week vs dated sessions, activities, milestones, finishing date, and sessions.
      - If the selected intervention is PLAN_ATTENTION, call missing future sessions a schedule setup gap, not proof the user failed the goal.
      - Use at most one personal insight from the coach context brief, and only if it makes the proposal clearer.
      - When saying the user logged, did, trained, or practiced something recently/lately, rely only on explicit recent activity logs in the context or readActivities output. Active plans are not recent activity evidence.
      - Lead with the concrete risk or decision. Give one action; do not pad it with routine praise.
      - Never ask "how did it go?", "how did it feel?", or another generic retrospective question.
      - Ask only when the answer is required to choose or apply the plan action.
      - Use one short message of at most 2 sentences. Sound direct and natural.
    `;
  }

  private async dispatchCoachDrafts(
    user: User,
    candidate: CoachInterventionCandidate,
    drafts: CoachDraftMessage[],
    notificationTitle?: string,
  ): Promise<{ messageIds: string[]; notificationId?: string }> {
    const { chat } = await this.ensureCoachChat(user);
    const messageIds: string[] = [];
    const hasNewPlanCreationProposal = drafts.some(
      (draft) => (draft.planCreationProposals?.length || 0) > 0,
    );

    for (const draft of drafts) {
      const isGenerationError = draft.error === true;
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
              activityEditProposals: draft.activityEditProposals || [],
              coachAttentionItems: candidate.attentionItems || [],
              escalationCount: candidate.escalationCount || 0,
              error: isGenerationError,
              coachGenerationStatus: isGenerationError ? "error" : "ok",
              retryable: isGenerationError,
              retryCount: 0,
              ...(draft.toolCalls && { toolCalls: draft.toolCalls }),
            }),
          ),
        },
      });
      messageIds.push(message.id);
    }

    if (hasNewPlanCreationProposal) {
      await cancelPendingPlanCreationProposals(chat.id, messageIds);
    }

    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    const hasProposal = drafts.some(
      (d) =>
        (d.planProposals && d.planProposals.length > 0) ||
        (d.activityLogProposals && d.activityLogProposals.length > 0) ||
        (d.activityEditProposals && d.activityEditProposals.length > 0) ||
        (d.planCreationProposals && d.planCreationProposals.length > 0),
    );
    const pendingActionCount = drafts.reduce(
      (count, draft) =>
        count +
        (draft.planProposals?.filter((proposal) => !proposal.status).length ||
          0) +
        (draft.planCreationProposals?.filter((proposal) => !proposal.status)
          .length || 0) +
        (draft.activityLogProposals?.filter((proposal) => !proposal.status)
          .length || 0) +
        (draft.activityEditProposals?.filter((proposal) => !proposal.status)
          .length || 0),
      0,
    );

    const notification = await notificationService.createAndProcessNotification(
      {
        userId: user.id,
        title:
          notificationTitle ||
          this.getNotificationTitle(candidate.type, hasProposal),
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
          coachAttentionItems: candidate.attentionItems || [],
          escalationCount: candidate.escalationCount || 0,
        },
      },
      true,
    );

    return { messageIds, notificationId: notification?.id };
  }

  private getNotificationTitle(
    type: CoachInterventionType,
    hasProposal: boolean,
  ): string {
    if (hasProposal) return "Plan adjustment";
    const titles: Record<CoachInterventionType, string> = {
      INACTIVITY_ARCHIVE_PROPOSAL: "Plan archive suggestion",
      PLAN_ATTENTION_ARCHIVED: "Plan archived",
      INACTIVITY_PAUSE_PROPOSAL: "Plan pause suggestion",
      PLAN_ATTENTION: "Plan needs attention",
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
    _options: {
      force: boolean;
      pendingProposalExists: boolean;
      fallbackCheckin?: boolean;
    },
  ): Promise<CoachInterventionCandidate[]> {
    const timezone = user.timezone || "UTC";
    const nowInTz = new TZDate(now, timezone);
    const { start: currentWeekStart } = getCoachWeekBounds(now, timezone);
    const currentWeekStartKey = format(currentWeekStart, "yyyy-MM-dd");
    const isWeeklyReviewWindow =
      nowInTz.getDay() === 1 && isWithinPreferredCoachWindow(user, now);

    if (!_options.force && !isWeeklyReviewWindow) return [];

    const { start: previousWeekStart } = getPreviousCoachWeekBounds(
      now,
      timezone,
    );
    const { end: currentWeekEnd } = getCoachWeekBounds(now, timezone);
    const activityIds = Array.from(
      new Set(user.plans.flatMap((plan) => plan.activities.map((a) => a.id))),
    );
    const entries =
      activityIds.length > 0
        ? await prisma.activityEntry.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              activityId: { in: activityIds },
              datetime: { gte: previousWeekStart, lte: currentWeekEnd },
            },
            orderBy: { datetime: "asc" },
          })
        : [];
    const attentionItems = deriveCoachAttentionItems({
      user,
      plans: user.plans,
      now,
    });
    const weeklyReviewContext = buildWeeklyReviewOverview({
      plans: user.plans,
      entries,
      now,
      timezone,
    });
    const externalAgentContext = await this.buildExternalAgentContext(
      user,
      now,
    );

    return [
      {
        type: "WEEK_RECAP",
        reason: "The user's single weekly recap and upcoming-week plan is due.",
        planIds: user.plans.map((plan) => plan.id),
        targetWeekStart: currentWeekStartKey,
        context: [
          weeklyReviewContext,
          externalAgentContext,
          formatCoachAttentionContext(attentionItems),
        ]
          .filter(Boolean)
          .join("\n\n"),
        usesAgent: true,
      },
    ];
  }

  private attentionItemMatchesCandidate(
    item: CoachAttentionItem,
    candidate: CoachInterventionCandidate,
  ) {
    if (
      candidate.attentionItems?.some(
        (candidateItem) => candidateItem.dedupeKey === item.dedupeKey,
      )
    ) {
      return true;
    }

    return item.planIds.some((planId) => candidate.planIds.includes(planId));
  }

  private async getPlanAttentionNotificationHistory(
    userId: string,
    candidate: Pick<CoachInterventionCandidate, "planIds" | "attentionItems">,
  ) {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        type: "COACH",
        promptTag: AUTONOMOUS_PROMPT_TAG,
        relatedData: {
          path: ["interventionType"],
          equals: "PLAN_ATTENTION",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return notifications.filter((notification) => {
      const relatedData = notification.relatedData as any;
      const items = Array.isArray(relatedData?.coachAttentionItems)
        ? relatedData.coachAttentionItems
        : [];
      const itemMatch = items.some((item: CoachAttentionItem) =>
        this.attentionItemMatchesCandidate(
          item,
          candidate as CoachInterventionCandidate,
        ),
      );
      const planIds = Array.isArray(relatedData?.planIds)
        ? relatedData.planIds
        : [];
      const planMatch = planIds.some((planId: string) =>
        candidate.planIds.includes(planId),
      );

      return itemMatch || planMatch;
    });
  }

  private shouldSendPlanAttentionFollowUp(
    history: Array<{ createdAt: Date }>,
    now: Date,
  ) {
    if (history.length === 0) return true;
    if (history.length > PLAN_ATTENTION_FOLLOW_UP_DELAYS_HOURS.length) {
      return false;
    }

    const latest = history[0];
    const requiredDelay =
      PLAN_ATTENTION_FOLLOW_UP_DELAYS_HOURS[history.length - 1];
    return differenceInHours(now, latest.createdAt) >= requiredDelay;
  }

  private withPlanAttentionEscalation(
    candidate: CoachInterventionCandidate,
    history: Array<{ createdAt: Date }>,
    now: Date,
  ): CoachInterventionCandidate {
    if (history.length === 0) return candidate;

    const firstSent = history[history.length - 1];
    const hoursSinceFirst = differenceInHours(now, firstSent.createdAt);
    const escalationCount = history.length;

    return {
      ...candidate,
      escalationCount,
      reason: `${candidate.reason}. This is still unresolved after ${escalationCount} coach nudge${escalationCount === 1 ? "" : "s"}.`,
      context: [
        candidate.context,
        "",
        `Escalation: unresolved for ${hoursSinceFirst} hours since the first coach nudge. This is follow-up ${escalationCount + 1}; be more direct and concrete than the previous outreach while still helping the user repair the plan.`,
      ].join("\n"),
    };
  }

  private async findRupturedPlanAttentionItems(
    user: CoachUser,
    now: Date,
  ): Promise<CoachAttentionItem[]> {
    // Never hard-archive a plan whose week content a live connected agent
    // maintains — a dry schedule there is the agent's cadence, not rupture.
    const deferredPlanIds = new Set(
      user.plans
        .filter((plan) => coachDefersWeekContent(plan, now))
        .map((plan) => plan.id),
    );
    const attentionItems = deriveCoachAttentionItems({
      user,
      plans: user.plans,
      now,
    }).filter(
      (item) =>
        (item.kind === "SPECIFIC_NO_FUTURE_SESSIONS" ||
          item.kind === "PLAN_PAST_END_DATE") &&
        item.severity === "critical" &&
        !item.planIds.some((planId) => deferredPlanIds.has(planId)),
    );

    const ruptured: CoachAttentionItem[] = [];
    for (const item of attentionItems) {
      const history = await this.getPlanAttentionNotificationHistory(user.id, {
        planIds: item.planIds,
        attentionItems: [item],
      });
      if (history.length < PLAN_ATTENTION_ARCHIVE_MIN_NOTIFICATIONS) continue;

      const firstSent = history[history.length - 1];
      if (
        differenceInHours(now, firstSent.createdAt) >=
        PLAN_ATTENTION_ARCHIVE_AFTER_HOURS
      ) {
        ruptured.push(item);
      }
    }

    return ruptured;
  }

  private buildArchivedAttentionItem(
    item: CoachAttentionItem,
    now: Date,
  ): CoachAttentionItem {
    return {
      ...item,
      dedupeKey: `${item.dedupeKey}:archived:${format(now, "yyyy-MM-dd")}`,
      kind: "SPECIFIC_AUTO_ARCHIVED",
      severity: "critical",
      title: `${item.planEmoji || ""} ${item.planGoal} was archived`.trim(),
      message:
        item.kind === "PLAN_PAST_END_DATE"
          ? "The coach archived this plan after its end date passed without a decision. You can unarchive it when you are ready to renew it."
          : "The coach archived this plan after repeated unresolved schedule warnings. You can unarchive it when you are ready to rebuild the schedule.",
      primaryAction: {
        type: "VIEW_COACH_CHAT",
        prompt: `Review why "${item.planGoal}" was archived and decide whether to restore it.`,
      },
      generatedAt: now.toISOString(),
    };
  }

  private async archiveRupturedPlanAttentionItems(
    user: User,
    items: CoachAttentionItem[],
    now: Date,
  ): Promise<{ messageIds: string[]; notificationId?: string }> {
    const planIds = Array.from(new Set(items.flatMap((item) => item.planIds)));
    const plans = await prisma.plan.findMany({
      where: {
        id: { in: planIds },
        userId: user.id,
        deletedAt: null,
        archivedAt: null,
      },
    });

    if (plans.length === 0) return { messageIds: [] };

    await prisma.plan.updateMany({
      where: { id: { in: plans.map((plan) => plan.id) } },
      data: {
        archivedAt: now,
        coachSuggestedTimesPerWeek: null,
        coachNotes: null,
      },
    });

    const { chat } = await this.ensureCoachChat(user);
    const archivedItems = items.map((item) =>
      this.buildArchivedAttentionItem(item, now),
    );
    const planList = plans
      .map((plan) => `${plan.emoji || ""} ${plan.goal}`.trim())
      .join(", ");
    const content =
      plans.length === 1
        ? `I archived ${planList} because it stayed unresolved after repeated coach nudges. You can unarchive it from old and archived plans when you are ready to rebuild it.`
        : `I archived these plans because they stayed unresolved after repeated coach nudges: ${planList}. You can unarchive them from old and archived plans when you are ready to rebuild them.`;

    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "COACH",
        content,
        metadata: {
          source: AUTONOMOUS_PROMPT_TAG,
          interventionType: "PLAN_ATTENTION_ARCHIVED",
          planIds,
          coachAttentionItems: archivedItems,
        },
      },
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: now },
    });

    const notification = await notificationService.createAndProcessNotification(
      {
        userId: user.id,
        title: "Plan archived",
        message: content,
        type: "COACH",
        relatedId: chat.id,
        promptTag: AUTONOMOUS_PROMPT_TAG,
        relatedData: {
          type: "COACH_ASSESSMENT",
          interventionType: "PLAN_ATTENTION_ARCHIVED",
          planIds,
          messageIds: [message.id],
          pendingActionCount: 0,
          coachAttentionItems: archivedItems,
        },
      },
      true,
    );

    return { messageIds: [message.id], notificationId: notification?.id };
  }

  private async selectInterventionCandidate(
    user: User,
    candidates: CoachInterventionCandidate[],
    options: { bypassDuplicateCheck?: boolean; now?: Date } = {},
  ): Promise<CoachInterventionCandidate | null> {
    const now = options.now || new Date();
    for (const type of INTERVENTION_PRIORITY) {
      const matching = candidates.filter(
        (candidate) => candidate.type === type,
      );
      for (const candidate of matching) {
        if (options.bypassDuplicateCheck) return candidate;
        if (candidate.type === "PLAN_ATTENTION") {
          const history = await this.getPlanAttentionNotificationHistory(
            user.id,
            candidate,
          );
          if (this.shouldSendPlanAttentionFollowUp(history, now)) {
            return this.withPlanAttentionEscalation(candidate, history, now);
          }
          continue;
        }
        const sent = await this.hasSentIntervention(user.id, candidate);
        if (!sent) return candidate;
      }
    }
    return null;
  }

  private async hasSentIntervention(
    userId: string,
    candidate: CoachInterventionCandidate,
  ): Promise<boolean> {
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

  private async buildVisibleWeeklyOverviewContext(
    user: CoachUser,
    now: Date,
  ): Promise<string> {
    const timezone = user.timezone || "UTC";
    const { start: currentWeekStart } = getCoachWeekBounds(now, timezone);
    const visibleWindowEnd = endOfDay(addDays(currentWeekStart, 13));
    const activityIds = Array.from(
      new Set(user.plans.flatMap((plan) => plan.activities.map((a) => a.id))),
    );
    const entries =
      activityIds.length > 0
        ? await prisma.activityEntry.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
              activityId: { in: activityIds },
              datetime: { gte: currentWeekStart, lte: visibleWindowEnd },
            },
            orderBy: { datetime: "asc" },
          })
        : [];

    return buildAssessmentWeeklyOverview({
      plans: user.plans,
      entries,
      now,
      timezone,
    });
  }

  // Context block for plans whose week content a connected agent plans over
  // MCP. Tells the coach whose turn it is (liveness ladder) and inlines the
  // agent's status.md progression contract when present.
  private async buildExternalAgentContext(
    user: CoachUser,
    now: Date,
  ): Promise<string> {
    const managedPlans = user.plans.filter(isExternalAgentManaged);
    if (managedPlans.length === 0) return "";

    const lines = ["External agent status:"];
    for (const plan of managedPlans) {
      const tier = getExternalAgentPresenceTier(
        plan.externalAgentLastSyncAt,
        now,
      );
      const days = daysSinceExternalAgentSync(plan, now);
      const syncedLabel =
        days === null
          ? "never synced"
          : days === 0
            ? "synced today"
            : `last synced ${days} day${days === 1 ? "" : "s"} ago`;
      lines.push(
        `- "${plan.goal}": week content is planned by the user's connected agent (${syncedLabel}).`,
      );
      if (tier === "fresh") {
        lines.push(
          "  The agent owns this plan's week content. Do not plan or adjust its sessions; stay on accountability: logging, deadline realism, celebration.",
        );
      } else if (tier === "stale") {
        lines.push(
          `  The agent has not synced in ${days} days. If you message the user, fold in ONE gentle line asking whether the sessions are still happening or the agent just has not synced.`,
        );
      } else {
        lines.push(
          "  The agent appears inactive. Week planning falls back to you: coach this plan normally and offer to take week planning back over.",
        );
      }

      const statusFile = await readExternalAgentStatusFile(plan.id);
      if (statusFile) {
        lines.push("  Agent status file (status.md):");
        lines.push(
          truncateStatusForContext(statusFile)
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n"),
        );
      }
    }
    return lines.join("\n");
  }

  private async buildPlanAssessmentSummary(
    user: User,
    plan: CoachPlan,
    now: Date,
  ) {
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);
    const activityIds = plan.activities.map((a) => a.id);
    const entries =
      activityIds.length > 0
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
      (s) => s.date >= startOfDay(sevenDaysAgo) && s.date < startOfDay(now),
    );
    const completedSessionsThisWeek = sessionsThisWeek.filter((session) =>
      entries.some(
        (entry) =>
          entry.activityId === session.activityId &&
          isSameDay(entry.datetime, session.date),
      ),
    ).length;
    const missedSessionsThisWeek =
      sessionsThisWeek.length - completedSessionsThisWeek;
    const entriesLast7Days = entries.filter(
      (e) => e.datetime >= sevenDaysAgo,
    ).length;
    const entriesLast30Days = entries.filter(
      (e) => e.datetime >= thirtyDaysAgo,
    ).length;
    const weeklySummary =
      plan.outlineType === "TIMES_PER_WEEK"
        ? buildPlanWeekProjection({
            plans: [plan],
            entries,
            now,
            timezone: user.timezone || "UTC",
            weekCount: 2,
          }).summaries.find((summary) => summary.weekIndex === 0) ?? null
        : null;
    const weeklyPressure =
      weeklySummary && weeklySummary.status === "overloaded"
        ? `overloaded by ${weeklySummary.overflow} session${weeklySummary.overflow === 1 ? "" : "s"}`
        : weeklySummary && weeklySummary.status === "at_risk"
          ? `tight, ${weeklySummary.slackDays} spare day${weeklySummary.slackDays === 1 ? "" : "s"}`
          : weeklySummary?.status.replace("_", " ") ?? null;

    const context = [
      `Plan: ${plan.emoji || ""} ${plan.goal}`,
      `Current week state: ${plan.currentWeekState || "unknown"}`,
      `Last activity: ${daysSinceLastActivity !== null ? `${daysSinceLastActivity} days ago` : "never"}`,
      `Entries last 7 days: ${entriesLast7Days}`,
      `Entries last 30 days: ${entriesLast30Days}`,
      weeklySummary
        ? `Times-per-week progress: ${weeklySummary.completedDays}/${weeklySummary.target} completed days, ${weeklySummary.remaining} remaining, ${weeklySummary.openDays} open days left, ${weeklyPressure}.`
        : null,
      `Recent sessions: ${completedSessionsThisWeek}/${sessionsThisWeek.length} completed, ${missedSessionsThisWeek} missed`,
    ].filter(Boolean).join("\n");

    return {
      plan,
      daysSinceLastActivity,
      totalSessionsThisWeek: sessionsThisWeek.length,
      completedSessionsThisWeek,
      missedSessionsThisWeek,
      weeklySummary: weeklySummary as PlanWeekSummary | null,
      context,
    };
  }

  private async buildContextSummary(
    user: CoachUser,
    now: Date,
  ): Promise<string> {
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);
    const userDayOfWeek = new TZDate(now, user.timezone || "UTC").getDay();
    const lines: string[] = [];
    const [visibleWeeklyOverviewContext, recentEntries] = await Promise.all([
      this.buildVisibleWeeklyOverviewContext(user, now),
      prisma.activityEntry.findMany({
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
      }),
    ]);

    lines.push(visibleWeeklyOverviewContext);
    lines.push("");
    lines.push("Additional assessment context:");
    lines.push(`Today: ${format(now, "yyyy-MM-dd (EEEE)")}`);
    lines.push(
      `Day of week: ${userDayOfWeek === 1 ? "Monday (recap day)" : format(now, "EEEE")}`,
    );
    lines.push(
      "Grounding rule: Only activities listed under recent activity logs may be described as logged recently/lately. Active plans alone are not activity history.",
    );
    lines.push(
      recentEntries.length > 0
        ? `Recent activity logs last 30 days: ${recentEntries
            .map((entry) =>
              entry.activity
                ? `${format(entry.datetime, "yyyy-MM-dd")} ${entry.activity.emoji} ${entry.activity.title}`
                : null,
            )
            .filter(Boolean)
            .join("; ")}`
        : "Recent activity logs last 30 days: none",
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
      const entriesLast7Days = entries.filter(
        (e) => e.datetime >= sevenDaysAgo,
      ).length;
      const entriesLast30Days = entries.filter(
        (e) => e.datetime >= thirtyDaysAgo,
      ).length;

      const sessionsLast7Days = plan.sessions.filter(
        (s) => s.date >= sevenDaysAgo && s.date < startOfDay(now),
      );
      const totalSessions = sessionsLast7Days.length;
      const completedSessions = sessionsLast7Days.filter((session) =>
        entries.some(
          (entry) =>
            entry.activityId === session.activityId &&
            format(entry.datetime, "yyyy-MM-dd") ===
              format(session.date, "yyyy-MM-dd"),
        ),
      ).length;
      const missedSessions = totalSessions - completedSessions;
      const weeklySummary =
        plan.outlineType === "TIMES_PER_WEEK"
          ? buildPlanWeekProjection({
              plans: [plan],
              entries,
              now,
              timezone: user.timezone || "UTC",
              weekCount: 2,
            }).summaries.find((summary) => summary.weekIndex === 0) ?? null
          : null;
      const weeklyPressure =
        weeklySummary && weeklySummary.status === "overloaded"
          ? `overloaded by ${weeklySummary.overflow}`
          : weeklySummary && weeklySummary.status === "at_risk"
            ? `tight, ${weeklySummary.slackDays} spare days`
            : weeklySummary?.status.replace("_", " ") ?? null;

      lines.push(`Plan: ${plan.emoji || ""} ${plan.goal}`);
      lines.push(
        `  Last activity: ${daysSinceLastActivity !== null ? `${daysSinceLastActivity} days ago` : "never"}`,
      );
      lines.push(`  Entries last 7 days: ${entriesLast7Days}`);
      lines.push(`  Entries last 30 days: ${entriesLast30Days}`);
      if (weeklySummary) {
        lines.push(
          `  Times-per-week progress: ${weeklySummary.completedDays}/${weeklySummary.target} completed days, ${weeklySummary.remaining} remaining, ${weeklySummary.openDays} open days left, ${weeklyPressure}`,
        );
      }
      lines.push(
        `  Sessions this week: ${completedSessions}/${totalSessions} completed, ${missedSessions} missed`,
      );
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
