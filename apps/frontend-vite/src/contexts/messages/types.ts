import { createContext } from "react";

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

export interface ImageAttachment {
  id?: string;
  url: string;
  mediaType: string;
  filename?: string;
}

export interface Message {
  id: string;
  chatId?: string;
  role: "USER" | "COACH" | "SYSTEM";
  content: string;
  status?: "SENT" | "READ";
  createdAt: string | Date;
  senderId?: string; // For DIRECT and GROUP chats
  senderName?: string;
  senderPicture?: string;
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
    activities: Array<{ activityId?: string | null; title: string; measure: string; emoji: string; kind?: string | null }>;
    finishingDate?: string | null;
    milestones?: Array<{ description: string; date?: string | null; criteria?: string | null }>;
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
    status: "accepted" | "rejected" | null;
  }>;
  toolCalls?: ToolCall[] | null;
  userAction?: UserAction | null;
  imageAttachments?: ImageAttachment[] | null;
  error?: boolean;
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
}

export interface MessagesContextType {
  // Chats
  chats: Chat[] | undefined;
  isLoadingChats: boolean;
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
  totalUnreadCount: number;

  // Messages
  messages: Message[] | undefined;
  isLoadingMessages: boolean;

  // Mutations
  sendMessage: (data: { message: string; chatId: string; coachVersion?: "v1" | "v2"; imageAttachments?: ImageAttachment[] }) => Promise<Message[]>;
  rewriteMessage: (data: { chatId: string; cacheChatId?: string; messageId: string; message: string }) => Promise<Message[]>;
  isSendingMessage: boolean;
  coachResponseStatus: "thinking" | "searching" | "browsing" | "drafting" | null;
  isAwaitingCoachResponse: boolean;
  coachResponseTimedOut: boolean;
  coachResponseErrorMessage: string | null;
  isRewritingMessage: boolean;
  pendingStaggeredMessages: Message[];
  createDirectChat: (userId: string) => Promise<Chat>;
  isCreatingDirectChat: boolean;
  markMessagesAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
  clearCoachHistory: () => Promise<void>;
  isClearingCoachHistory: boolean;
  clearCoachMemory: () => Promise<void>;
  isClearingCoachMemory: boolean;
}

export const MessagesContext = createContext<MessagesContextType | undefined>(undefined);
