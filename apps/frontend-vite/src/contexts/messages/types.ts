import { createContext } from "react";

export interface Message {
  id: string;
  role: "USER" | "COACH" | "SYSTEM";
  content: string;
  status?: "SENT" | "READ";
  createdAt: string | Date;
  senderId?: string; // For DIRECT and GROUP chats
  senderName?: string;
  senderPicture?: string;
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
  sendMessage: (data: { message: string; chatId: string }) => Promise<Message>;
  isSendingMessage: boolean;
  createDirectChat: (userId: string) => Promise<Chat>;
  isCreatingDirectChat: boolean;
  markMessagesAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
}

export const MessagesContext = createContext<MessagesContextType | undefined>(undefined);
