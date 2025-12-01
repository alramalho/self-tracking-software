import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { type MessageFeedback } from "./types";
import { type Chat, deserializeChat } from "@/contexts/messages/service";

type MessageFeedbackApiResponse = Omit<
  MessageFeedback,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

const deserializeFeedback = (
  feedback: MessageFeedbackApiResponse
): MessageFeedback => {
  return normalizeApiResponse<MessageFeedback>(feedback, [
    "createdAt",
    "updatedAt",
  ]);
};

// Create a coach chat (AI-specific)
export async function createCoachChat(
  api: AxiosInstance,
  data: { title?: string | null; initialCoachMessage?: string }
): Promise<Chat> {
  const response = await api.post<{ chat: any }>(
    "/ai/coach/chats",
    {
      title: data.title || null,
      initialCoachMessage: data.initialCoachMessage || null,
    }
  );
  return deserializeChat(response.data.chat);
}

// Update chat title (coach-specific)
export async function updateChatTitle(
  api: AxiosInstance,
  data: { chatId: string; title: string }
): Promise<Chat> {
  const response = await api.patch<{ chat: any }>(
    `/ai/coach/chats/${data.chatId}`,
    { title: data.title }
  );
  return deserializeChat(response.data.chat);
}

// Submit AI message feedback
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

// Accept a metric suggestion from AI
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

// Reject a metric suggestion from AI
export async function rejectMetric(
  api: AxiosInstance,
  messageId: string
): Promise<void> {
  await api.post(`/ai/messages/${messageId}/reject-metric`);
}

// Submit AI satisfaction feedback
export async function submitAISatisfaction(
  api: AxiosInstance,
  data: { liked: boolean; content?: string }
): Promise<void> {
  await api.post("/ai/feedback/ai-satisfaction", data);
}
