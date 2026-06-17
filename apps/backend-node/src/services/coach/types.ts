import type {
  Activity,
  Plan,
  PlanMilestone,
  PlanSession,
  User,
} from "@tsw/prisma";

export type ImageAttachment = {
  url: string;
  mediaType: string;
  filename?: string;
};

export type CoachConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  imageAttachments?: ImageAttachment[];
};

export type CoachStatus = "thinking" | "searching" | "browsing" | "drafting";

export type ActiveCoachPlan = Plan & {
  activities: Activity[];
  sessions: PlanSession[];
  milestones: PlanMilestone[];
};

export interface CoachAgentContext {
  user: User;
  plans: ActiveCoachPlan[];
  conversationHistory: CoachConversationMessage[];
  model?: string;
  memoriesContext?: string | null;
  recentActivityContext?: string | null;
  activityRecencyById?: Map<string, string>;
  curriculumFileCountByPlanId?: Map<string, number>;
  onStatus?: (status: CoachStatus) => void | Promise<void>;
}

export type CoachAgentTelemetry = {
  model: string;
  stepCount?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
  };
};

export type CoachAgentErrorReportContext = {
  source?: string;
  chatId?: string;
};

export type CoachGenerateResponseParams = {
  user: User;
  message: string;
  messageRole?: "user" | "system";
  imageAttachments?: ImageAttachment[];
  conversationHistory: CoachConversationMessage[];
  plans: ActiveCoachPlan[];
  model?: string;
  memoriesContext?: string | null;
  onStatus?: (status: CoachStatus) => void | Promise<void>;
  reportContext?: CoachAgentErrorReportContext;
};

export type CoachDraftMessage = {
  content: string;
  error?: boolean;
  planReplacements?: Array<{ textToReplace: string; planGoal: string }>;
  planProposals?: Array<{
    planId: string;
    planGoal: string;
    planEmoji: string | null;
    description: string;
    patch: unknown;
    operations?: unknown[];
    status: null;
  }>;
  planCreationProposals?: Array<{
    goal: string;
    goalReason: string | null;
    notes?: string | null;
    emoji: string | null;
    outlineType?: "SPECIFIC" | "TIMES_PER_WEEK" | null;
    timesPerWeek: number | null;
    activities: Array<{
      activityId?: string | null;
      title: string;
      measure: string;
      emoji: string;
      kind?: string | null;
    }>;
    finishingDate?: string | null;
    milestones?: Array<{
      description: string;
      date: string;
      criteria?: string | null;
    }>;
    sessions?: Array<{
      activityTitle: string;
      date: string;
      quantity?: number | null;
      descriptiveGuide?: string | null;
    }>;
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
    time?: string;
    description?: string;
    privateNotes?: string;
    difficulty?: "very_easy" | "easy" | "moderate" | "hard" | "very_hard";
    status: null;
  }>;
  activityEditProposals?: Array<{
    activityId: string;
    activityName: string;
    activityEmoji: string;
    description: string;
    original: {
      title: string;
      emoji: string;
      measure: string;
      colorHex: string | null;
      kind: string | null;
    };
    requested: {
      title: string;
      emoji: string;
      measure: string;
      colorHex: string | null;
      kind: string | null;
    };
    measureConversion: {
      operator: "multiply" | "divide";
      factor: number;
    } | null;
    status: null;
  }>;
  userContextEventProposals?: Array<{
    title: string;
    description?: string;
    occurredAt?: string;
    endedAt?: string;
    source?: string;
    confidence?: number | null;
    status: null;
  }>;
  toolCalls?: Array<{ tool: string; args: unknown; result: unknown }>;
};

export type CoachAgentResponse = {
  draftMessages: CoachDraftMessage[];
  skipped?: boolean;
  skipReason?: string;
  telemetry?: CoachAgentTelemetry;
};
