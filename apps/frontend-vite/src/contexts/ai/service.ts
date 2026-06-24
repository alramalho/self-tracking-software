import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { type CoachAssessmentResponse, type CoachAttentionItem, type MessageFeedback } from "./types";
import {
  type Chat,
  type Message,
  deserializeChat,
  deserializeMessage,
} from "@/contexts/messages/service";

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

export async function runCoachAssessment(
  api: AxiosInstance
): Promise<CoachAssessmentResponse> {
  const response = await api.post<CoachAssessmentResponse>(
    "/ai/coach/run-assessment"
  );
  return response.data;
}

export async function getCoachAttentionItems(
  api: AxiosInstance
): Promise<CoachAttentionItem[]> {
  const response = await api.get<{ attentionItems: CoachAttentionItem[] }>(
    "/ai/coach/attention"
  );
  return response.data.attentionItems;
}

export async function startCoachAttentionAction(
  api: AxiosInstance,
  data: { dedupeKey: string; guidance?: string }
): Promise<{ chat: Chat; messages: Message[]; systemMessageId: string }> {
  const response = await api.post<{
    chat: any;
    messages: any[];
    systemMessageId: string;
  }>("/chats/coach/attention/start", data);

  return {
    chat: deserializeChat(response.data.chat),
    messages: response.data.messages.map(deserializeMessage),
    systemMessageId: response.data.systemMessageId,
  };
}

// Dismiss an informational coach attention item (e.g. a "plan archived" notice)
// without opening the chat. Concludes the backing notification.
export async function dismissCoachAttentionItem(
  api: AxiosInstance,
  data: { dedupeKey?: string; planIds?: string[] }
): Promise<{ success: boolean; dismissed: number }> {
  const response = await api.post<{ success: boolean; dismissed: number }>(
    "/ai/coach/attention/dismiss",
    data
  );
  return response.data;
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

// Accept a plan proposal from AI
export async function acceptProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/accept-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

// Reject a plan proposal from AI
export async function rejectProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/reject-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

export async function acceptPlanCreationProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<{ success: boolean; plan?: { id: string } }> {
  const response = await api.post<{ success: boolean; plan?: { id: string } }>(`/ai/messages/${data.messageId}/accept-plan-creation-proposal`, {
    proposalIndex: data.proposalIndex,
  });
  return response.data;
}

export async function rejectPlanCreationProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/reject-plan-creation-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

export async function proposePlanCreationChanges(
  api: AxiosInstance,
  data: {
    messageId: string;
    proposalIndex: number;
    requestedProposal: unknown;
    note?: string | null;
  }
): Promise<Message[]> {
  const response = await api.post<{ messages: any[] }>(
    `/ai/messages/${data.messageId}/propose-plan-creation-changes`,
    {
      proposalIndex: data.proposalIndex,
      requestedProposal: data.requestedProposal,
      note: data.note || null,
    }
  );
  return response.data.messages.map(deserializeMessage);
}

// Accept an activity log proposal from AI
export async function acceptActivityLogProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/accept-activity-log-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

// Reject an activity log proposal from AI
export async function rejectActivityLogProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/reject-activity-log-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

export async function acceptActivityEditProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/accept-activity-edit-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

export async function rejectActivityEditProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/reject-activity-edit-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

export async function acceptUserContextEventProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<{ success: boolean; event?: { id: string } }> {
  const response = await api.post<{ success: boolean; event?: { id: string } }>(
    `/ai/messages/${data.messageId}/accept-user-context-event-proposal`,
    {
      proposalIndex: data.proposalIndex,
    }
  );
  return response.data;
}

export async function rejectUserContextEventProposal(
  api: AxiosInstance,
  data: { messageId: string; proposalIndex: number }
): Promise<void> {
  await api.post(`/ai/messages/${data.messageId}/reject-user-context-event-proposal`, {
    proposalIndex: data.proposalIndex,
  });
}

// Submit AI satisfaction feedback
export async function submitAISatisfaction(
  api: AxiosInstance,
  data: { liked: boolean; content?: string }
): Promise<void> {
  await api.post("/ai/feedback/ai-satisfaction", data);
}
