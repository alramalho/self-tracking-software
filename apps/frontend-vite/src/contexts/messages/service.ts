import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { type Chat, type Message } from "./types";

export type { Chat, Message } from "./types";

type ChatApiResponse = Omit<Chat, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type MessageApiResponse = Omit<Message, "createdAt"> & {
  createdAt: string;
};

export const deserializeChat = (chat: ChatApiResponse): Chat => {
  return normalizeApiResponse<Chat>(chat, ["createdAt", "updatedAt"]);
};

export const deserializeMessage = (message: MessageApiResponse): Message => {
  return normalizeApiResponse<Message>(message, ["createdAt"]);
};

// Get all chats (coach, direct, group)
export async function getChats(api: AxiosInstance): Promise<Chat[]> {
  const response = await api.get<{ chats: ChatApiResponse[] }>("/chats");
  return response.data.chats.map(deserializeChat);
}

// Get messages for any chat type
export async function getMessages(
  api: AxiosInstance,
  chatId: string
): Promise<Message[]> {
  const response = await api.get<{ messages: MessageApiResponse[] }>(
    `/chats/${chatId}/messages`
  );
  return response.data.messages.map(deserializeMessage);
}

// Send message to any chat type (coach, direct, group)
export async function sendMessage(
  api: AxiosInstance,
  data: { message: string; chatId: string }
): Promise<Message> {
  const response = await api.post<{ message: MessageApiResponse }>(
    `/chats/${data.chatId}/messages`,
    { message: data.message }
  );
  return deserializeMessage(response.data.message);
}

// Create a direct message chat with another user
export async function createDirectChat(
  api: AxiosInstance,
  userId: string
): Promise<Chat> {
  const response = await api.post<{ chat: ChatApiResponse }>("/chats/direct", {
    userId,
  });
  return deserializeChat(response.data.chat);
}
