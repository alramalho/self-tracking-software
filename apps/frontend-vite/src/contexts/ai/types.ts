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

export interface AIContextType extends MessagesContextType {
  // Coach chat creation
  createCoachChat: (data: {
    title?: string | null;
    initialCoachMessage?: string;
  }) => Promise<Chat>;
  isCreatingCoachChat: boolean;

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

  // AI satisfaction
  submitAISatisfaction: (data: { liked: boolean; content?: string }) => Promise<void>;
  isSubmittingAISatisfaction: boolean;

  // Whitelist
  isUserAIWhitelisted: boolean;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);
