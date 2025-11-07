import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { type Chat, type Message, type MessageFeedback } from "./types";

type ChatApiResponse = Omit<Chat, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type MessageApiResponse = Omit<Message, "createdAt"> & {
  createdAt: string;
};

type MessageFeedbackApiResponse = Omit<
  MessageFeedback,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

const deserializeChat = (chat: ChatApiResponse): Chat => {
  return normalizeApiResponse<Chat>(chat, ["createdAt", "updatedAt"]);
};

const deserializeMessage = (message: MessageApiResponse): Message => {
  return normalizeApiResponse<Message>(message, ["createdAt"]);
};

const deserializeFeedback = (
  feedback: MessageFeedbackApiResponse
): MessageFeedback => {
  return normalizeApiResponse<MessageFeedback>(feedback, [
    "createdAt",
    "updatedAt",
  ]);
};

// Get all chats (coach, direct, group) - uses new unified endpoint
export async function getChats(api: AxiosInstance): Promise<Chat[]> {
  const response = await api.get<{ chats: ChatApiResponse[] }>("/chats");
  return response.data.chats.map(deserializeChat);
}

// Get messages for any chat type - uses new unified endpoint
export async function getMessages(
  api: AxiosInstance,
  chatId: string
): Promise<Message[]> {
  const response = await api.get<{ messages: MessageApiResponse[] }>(
    `/chats/${chatId}/messages`
  );
  return response.data.messages.map(deserializeMessage);
}

export async function createChat(
  api: AxiosInstance,
  data: { title?: string | null; initialCoachMessage?: string }
): Promise<Chat> {
  const response = await api.post<{ chat: ChatApiResponse }>(
    "/ai/coach/chats",
    {
      title: data.title || null,
      initialCoachMessage: data.initialCoachMessage || null,
    }
  );
  return deserializeChat(response.data.chat);
}

// Send message to any chat type (coach, direct, group) - uses new unified endpoint
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

export async function updateChatTitle(
  api: AxiosInstance,
  data: { chatId: string; title: string }
): Promise<Chat> {
  const response = await api.patch<{ chat: ChatApiResponse }>(
    `/ai/coach/chats/${data.chatId}`,
    { title: data.title }
  );
  return deserializeChat(response.data.chat);
}

export async function submitFeedback(
  api: AxiosInstance,
  data: {
    messageId: string;
    feedbackType: "POSITIVE" | "NEGATIVE";
    feedbackReasons?: string[];
    additionalComments?: string;
  }
): Promise<MessageFeedback> {
  const response = await api.post<{ feedback: MessageFeedbackApiResponse }>(
    `/ai/coach/messages/${data.messageId}/feedback`,
    {
      feedbackType: data.feedbackType,
      feedbackReasons: data.feedbackReasons || [],
      additionalComments: data.additionalComments || null,
    }
  );
  return deserializeFeedback(response.data.feedback);
}

export async function acceptMetric(
  api: AxiosInstance,
  data: {
    messageId: string;
    date?: string;
  }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/accept-metric`, {
    date: data.date || null,
  });
}

export async function rejectMetric(
  api: AxiosInstance,
  messageId: string
): Promise<void> {
  await api.post(`/ai/messages/${messageId}/reject-metric`);
}

export async function submitAISatisfaction(
  api: AxiosInstance,
  data: { liked: boolean; content?: string }
): Promise<void> {
  await api.post("/ai/feedback/ai-satisfaction", data);
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
