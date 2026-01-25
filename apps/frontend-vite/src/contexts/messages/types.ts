import { createContext } from "react";

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface Message {
  id: string;
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
  toolCalls?: ToolCall[] | null;
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
  sendMessage: (data: { message: string; chatId: string; coachVersion?: "v1" | "v2" }) => Promise<Message>;
  isSendingMessage: boolean;
  createDirectChat: (userId: string) => Promise<Chat>;
  isCreatingDirectChat: boolean;
  markMessagesAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
}

export const MessagesContext = createContext<MessagesContextType | undefined>(undefined);
