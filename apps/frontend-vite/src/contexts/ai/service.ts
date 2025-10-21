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

type MessageFeedbackApiResponse = Omit<MessageFeedback, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

const deserializeChat = (chat: ChatApiResponse): Chat => {
  return normalizeApiResponse<Chat>(chat, ["createdAt", "updatedAt"]);
};

const deserializeMessage = (message: MessageApiResponse): Message => {
  return normalizeApiResponse<Message>(message, ["createdAt"]);
};

const deserializeFeedback = (feedback: MessageFeedbackApiResponse): MessageFeedback => {
  return normalizeApiResponse<MessageFeedback>(feedback, ["createdAt", "updatedAt"]);
};

export async function getChats(api: AxiosInstance): Promise<Chat[]> {
  const response = await api.get<{ chats: ChatApiResponse[] }>(
    "/ai/coach/chats"
  );
  return response.data.chats.map(deserializeChat);
}

export async function getMessages(
  api: AxiosInstance,
  chatId: string
): Promise<Message[]> {
  const response = await api.get<{ messages: MessageApiResponse[] }>(
    `/ai/coach/messages?chatId=${chatId}`
  );
  return response.data.messages.map(deserializeMessage);
}

export async function createChat(
  api: AxiosInstance,
  data: { title?: string | null }
): Promise<Chat> {
  const response = await api.post<{ chat: ChatApiResponse }>(
    "/ai/coach/chats",
    { title: data.title || null }
  );
  return deserializeChat(response.data.chat);
}

export async function sendMessage(
  api: AxiosInstance,
  data: { message: string; chatId: string }
): Promise<Message> {
  const response = await api.post<{ message: MessageApiResponse }>(
    "/ai/coach/chat",
    { message: data.message, chatId: data.chatId }
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
