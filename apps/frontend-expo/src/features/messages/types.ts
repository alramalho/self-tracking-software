import type { CoachConversationStarterId } from "@tsw/prisma/coach-conversation-starters";
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface UserActionDiff {
  label: string;
  oldValue: string;
  newValue: string;
}

export interface UserAction {
  type: "PLAN_CREATION_CHANGES_PROPOSED";
  title: string;
  diffs: UserActionDiff[];
  note?: string | null;
  originalProposal?: unknown;
  requestedProposal?: unknown;
  proposalMessageId?: string;
  proposalIndex?: number;
}

export interface CoachAttentionItem {
  dedupeKey: string;
  kind:
    | "SPECIFIC_NO_FUTURE_SESSIONS"
    | "SPECIFIC_SCHEDULE_ENDING"
    | "SPECIFIC_AUTO_ARCHIVED"
    | "PLAN_PAST_END_DATE";
  severity: "critical" | "warning" | "info";
  planIds: string[];
  planGoal: string;
  planEmoji: string | null;
  title: string;
  message: string;
  facts: Array<{ label: string; value: string }>;
  primaryAction: {
    type: "START_PLAN_UPDATE";
    prompt: string;
  };
  generatedAt: string;
}

export interface ImageAttachment {
  id?: string;
  url: string;
  mediaType: string;
  filename?: string;
}

export interface Message {
  planId?: string | null;
  planIds?: string[];
  requiresReply?: boolean;
  id: string;
  chatId?: string;
  role: "USER" | "COACH" | "SYSTEM";
  content: string;
  status?: "SENT" | "READ";
  createdAt: string | Date;
  senderId?: string; // For DIRECT and GROUP chats
  senderName?: string;
  senderPicture?: string;
  feedback?: {
    metadata?: {
      feedbackType: "POSITIVE" | "NEGATIVE";
      feedbackReasons?: string[];
    };
    content?: string | null;
  } | null;
  // Coach message fields
  planReplacements?: Array<{
    textToReplace: string;
    plan: { id: string; goal: string; emoji?: string | null };
  }>;
  metricReplacement?: {
    textToReplace: string;
    rating: number;
    metric: { id: string; title: string; emoji?: string | null };
    status?: string;
  } | null;
  userRecommendations?: Array<{
    userId: string;
    username: string;
    name: string;
    picture?: string;
    planGoal?: string;
    planEmoji?: string;
    score: number;
    matchReasons: string[];
  }> | null;
  /** A silent "you've gone quiet" message from the coach, with two app actions. */
  nudge?: import("@tsw/prisma/follow-through").CoachNudge | null;
  planProposals?: Array<{
    planId: string;
    planGoal: string;
    planEmoji: string | null;
    description: string;
    patch?: unknown;
    operations?: unknown[];
    status: "accepted" | "rejected" | null;
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
      date?: string | null;
      criteria?: string | null;
    }>;
    sessions?: Array<{
      activityTitle: string;
      date: string;
      quantity?: number | null;
      descriptiveGuide?: string | null;
    }>;
    description: string;
    status: "accepted" | "rejected" | "changes_requested" | "cancelled" | null;
    planId?: string;
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
    status: "accepted" | "rejected" | null;
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
    measureConversion?: {
      operator: "multiply" | "divide";
      factor: number;
    } | null;
    status: "accepted" | "rejected" | null;
  }>;
  userContextEventProposals?: Array<{
    title: string;
    description?: string | null;
    occurredAt?: string | null;
    endedAt?: string | null;
    source?: string | null;
    confidence?: number | null;
    status: "accepted" | "rejected" | null;
    contextEventId?: string | null;
  }>;
  coachAttentionItems?: CoachAttentionItem[];
  toolCalls?: ToolCall[] | null;
  userAction?: UserAction | null;
  imageAttachments?: ImageAttachment[] | null;
  error?: boolean;
  coachGenerationStatus?: "ok" | "error" | "retried_success" | string;
  retryable?: boolean;
  retryCount?: number;
  /** Origin tag, e.g. "autonomous_coach" for proactive coach assessment messages. */
  source?: string | null;
}

export type ChatType = "COACH" | "DIRECT" | "GROUP";

export interface ChatParticipant {
  id: string;
  userId: string;
  name?: string;
  username?: string;
  picture?: string;
  joinedAt: string | Date;
  leftAt?: string | Date | null;
}

export interface LatestCoachMessagePreview {
  id: string;
  content: string;
  createdAt: string | Date;
  isUnread: boolean;
}

export interface SendMessageInput {
  message: string;
  chatId: string;
  coachVersion?: "v1" | "v2";
  imageAttachments?: ImageAttachment[];
  coachStarterId?: CoachConversationStarterId;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  // For COACH chats
  coachId?: string;
  // For DIRECT chats
  participants?: ChatParticipant[];
  // For GROUP chats
  planGroupId?: string;
  planGroupName?: string;
  // Unread message count
  unreadCount?: number;
  // Latest message preview
  lastMessage?: {
    content: string;
    senderName?: string;
    createdAt: string | Date;
  };
  latestCoachMessage?: LatestCoachMessagePreview;
}

export interface Coach {
  id: string;
  ownerId: string;
  owner: { id: string; name?: string; username?: string; picture?: string };
}
export interface ResponseState {
  status: "thinking" | "searching" | "browsing" | "drafting" | "error";
  timeoutAt: string;
  errorMessage?: string;
}
export interface SendPayload {
  planId?: string;
  chatId: string;
  message: string;
  imageAttachments?: ImageAttachment[];
  coachStarterId?: CoachConversationStarterId;
  rewriteId?: string;
  coach?: boolean;
}
export interface ConversationProps {
  id: string;
}
export interface MessageProps {
  message: Message;
  own: boolean;
  coach: boolean;
  onEdit: (message: Message) => void;
  onPrompt: (text: string) => void;
}
export interface MarkdownProps {
  children: string;
  message?: Message;
}

export interface MessageIconProps {
  label: string;
  children: import("react").ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

export interface CoachSettingsProps {
  visible: boolean;
  onClose: () => void;
}
export interface ProposalOperation {
  id?: string;
  type: string;
  activityId?: string;
  date?: string | Date;
  quantity?: number;
  descriptiveGuide?: string | null;
  goal?: string;
  goalReason?: string | null;
  notes?: string | null;
  timesPerWeek?: number | null;
  finishingDate?: string | null;
  outlineType?: string | null;
  description?: string;
  progress?: number | null;
  criteria?: unknown;
}
export interface ProposalPatch {
  archive?: boolean;
  track?: { title: string; measure: string; emoji: string }[];
  plan?: Partial<ProposalOperation>;
  sessions?: { upsert?: Partial<ProposalOperation>[]; deleteIds?: string[] };
  milestones?: { upsert?: Partial<ProposalOperation>[]; deleteIds?: string[] };
}
export interface SessionCardProps {
  op: ProposalOperation;
  activity?: { title: string; emoji?: string | null; measure: string };
  removed?: boolean;
}
export interface PlanProposalDetailsProps {
  compact?: boolean;
  proposal: NonNullable<Message["planProposals"]>[number];
}
export interface CoachToolsProps {
  tools: ToolCall[];
}
