import { createContext } from "react";

export interface MessageFeedback {
  id: string;
  messageId: string;
  userId: string;
  feedbackType: "POSITIVE" | "NEGATIVE";
  feedbackReasons: string[];
  additionalComments: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Message {
  id: string;
  role: "USER" | "COACH";
  content: string;
  createdAt: string | Date;
  feedback?: MessageFeedback[];
}

export interface Chat {
  id: string;
  title: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AIContextType {
  chats: Chat[] | undefined;
  isLoadingChats: boolean;
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
  messages: Message[] | undefined;
  isLoadingMessages: boolean;
  createChat: (data: {
    title?: string | null;
    initialCoachMessage?: string;
  }) => Promise<Chat>;
  isCreatingChat: boolean;
  sendMessage: (data: { message: string; chatId: string }) => Promise<Message>;
  isSendingMessage: boolean;
  updateChatTitle: (data: { chatId: string; title: string }) => Promise<Chat>;
  isUpdatingChatTitle: boolean;
  submitFeedback: (data: {
    messageId: string;
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons?: string[];
    additionalComments?: string;
  }) => Promise<MessageFeedback>;
  isSubmittingFeedback: boolean;
  acceptMetric: (data: { messageId: string; date?: string }) => Promise<void>;
  isAcceptingMetric: boolean;
  rejectMetric: (messageId: string) => Promise<void>;
  isRejectingMetric: boolean;
  submitAISatisfaction: (data: { liked: boolean; content?: string }) => Promise<void>;
  isSubmittingAISatisfaction: boolean;
  isUserAIWhitelisted: boolean;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);
