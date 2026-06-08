import { createContext } from "react";
import type { Chat, Message, MessagesContextType } from "@/contexts/messages";

// Re-export types from messages for backwards compatibility
export type { Chat, Message, ChatType, ChatParticipant } from "@/contexts/messages";

export interface MessageFeedback {
  id: string;
  messageId: string;
  userId: string;
  category: string; // "AI_MESSAGE_FEEDBACK"
  content: string | null; // additionalComments
  metadata: {
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons: string[];
    timestamp?: string;
  } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CoachAssessmentResult {
  username: string | null;
  userId: string;
  action: "sent" | "skipped" | "agent_skipped" | "error";
  reason: string;
  sentMessageIds?: string[];
  notificationId?: string;
}

export interface CoachAssessmentResponse {
  result: CoachAssessmentResult;
}

export interface CoachAttentionItem {
  dedupeKey: string;
  kind: "SPECIFIC_NO_FUTURE_SESSIONS" | "SPECIFIC_SCHEDULE_ENDING";
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

export interface AIContextType extends MessagesContextType {
  // Coach chat creation
  createCoachChat: (data: {
    title?: string | null;
    initialCoachMessage?: string;
  }) => Promise<Chat>;
  isCreatingCoachChat: boolean;
  runCoachAssessment: () => Promise<CoachAssessmentResponse>;
  isRunningCoachAssessment: boolean;
  lastCoachNoReportAt: string | null;

  // Chat title (coach-specific)
  updateChatTitle: (data: { chatId: string; title: string }) => Promise<Chat>;
  isUpdatingChatTitle: boolean;

  // AI feedback
  submitFeedback: (data: {
    messageId: string;
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons?: string[];
    additionalComments?: string;
  }) => Promise<MessageFeedback>;
  isSubmittingFeedback: boolean;

  // Metrics
  acceptMetric: (data: { messageId: string; date?: string }) => Promise<void>;
  isAcceptingMetric: boolean;
  rejectMetric: (messageId: string) => Promise<void>;
  isRejectingMetric: boolean;

  // Plan proposals
  acceptProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  rejectProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  acceptPlanCreationProposal: (data: { messageId: string; proposalIndex: number }) => Promise<{ success: boolean; plan?: { id: string } }>;
  rejectPlanCreationProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  proposePlanCreationChanges: (data: {
    messageId: string;
    proposalIndex: number;
    requestedProposal: unknown;
    note?: string | null;
  }) => Promise<Message[]>;

  // Activity log proposals
  acceptActivityLogProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  rejectActivityLogProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  acceptActivityEditProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  rejectActivityEditProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;
  acceptUserContextEventProposal: (data: { messageId: string; proposalIndex: number }) => Promise<{ success: boolean; event?: { id: string } }>;
  rejectUserContextEventProposal: (data: { messageId: string; proposalIndex: number }) => Promise<void>;

  // AI satisfaction
  submitAISatisfaction: (data: { liked: boolean; content?: string }) => Promise<void>;
  isSubmittingAISatisfaction: boolean;

  // Whitelist
  isUserAIWhitelisted: boolean;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);
