import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "../../utils/dateUtils";
import { type Chat, type Message } from "./types";
import { supabase } from "@/services/supabase";

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
  chatId: string,
  options?: { includeCoachHistory?: boolean }
): Promise<Message[]> {
  const params = options?.includeCoachHistory
    ? { includeCoachHistory: "true" }
    : undefined;
  const response = await api.get<{ messages: MessageApiResponse[] }>(
    `/chats/${chatId}/messages`,
    { params }
  );
  return response.data.messages.map(deserializeMessage);
}

// Send message to any chat type (coach, direct, group)
export async function sendMessage(
  api: AxiosInstance,
  data: { message: string; chatId: string; coachVersion?: "v1" | "v2" }
): Promise<Message[]> {
  const response = await api.post<{ messages?: MessageApiResponse[]; message: MessageApiResponse }>(
    `/chats/${data.chatId}/messages`,
    { message: data.message, coachVersion: data.coachVersion }
  );
  // New multi-message format (v2) or fallback to single message
  if (response.data.messages) {
    return response.data.messages.map(deserializeMessage);
  }
  return [deserializeMessage(response.data.message)];
}

export type CoachResponseStatus = "thinking" | "searching" | "drafting";

async function getStreamHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
  };
}

async function readMessageStreamResponse(
  response: Response,
  fallbackErrorMessage: string,
  onStatus?: (status: CoachResponseStatus) => void
): Promise<Message[]> {
  if (!response.ok || !response.body) {
    let errorMessage = fallbackErrorMessage;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.error === "string") {
        errorMessage = errorBody.error;
      }
    } catch {
      // Ignore non-JSON error responses.
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const donePayloadRef: {
    current: { messages?: MessageApiResponse[]; message: MessageApiResponse } | null;
  } = { current: null };

  const handleEvent = (rawEvent: string) => {
    const lines = rawEvent.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }

    if (dataLines.length === 0) return;
    const eventData = JSON.parse(dataLines.join("\n"));

    if (eventName === "status") {
      if (
        eventData?.state === "thinking" ||
        eventData?.state === "searching" ||
        eventData?.state === "drafting"
      ) {
        onStatus?.(eventData.state);
      }
      return;
    }

    if (eventName === "done") {
      donePayloadRef.current = eventData;
      return;
    }

    if (eventName === "error") {
      throw new Error(eventData?.error || fallbackErrorMessage);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (rawEvent) {
        handleEvent(rawEvent);
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleEvent(buffer.trim());
  }

  const donePayload = donePayloadRef.current;
  if (!donePayload) {
    throw new Error("Stream ended before the coach response completed");
  }

  if (donePayload.messages) {
    return donePayload.messages.map(deserializeMessage);
  }
  return [deserializeMessage(donePayload.message)];
}

export async function sendMessageStream(
  api: AxiosInstance,
  data: { message: string; chatId: string; coachVersion?: "v1" | "v2" },
  onStatus?: (status: CoachResponseStatus) => void
): Promise<Message[]> {
  const baseURL = api.defaults.baseURL || "";
  const response = await fetch(
    `${baseURL}/chats/${encodeURIComponent(data.chatId)}/messages/stream`,
    {
      method: "POST",
      headers: await getStreamHeaders(),
      body: JSON.stringify({
        message: data.message,
        coachVersion: data.coachVersion,
      }),
    }
  );

  return readMessageStreamResponse(response, "Failed to send message", onStatus);
}

export async function rewriteMessage(
  api: AxiosInstance,
  data: { chatId: string; messageId: string; message: string }
): Promise<Message[]> {
  const response = await api.post<{ messages: MessageApiResponse[] }>(
    `/chats/${data.chatId}/messages/${data.messageId}/rewrite`,
    { message: data.message }
  );
  return response.data.messages.map(deserializeMessage);
}

export async function rewriteMessageStream(
  api: AxiosInstance,
  data: { chatId: string; messageId: string; message: string },
  onStatus?: (status: CoachResponseStatus) => void
): Promise<Message[]> {
  const baseURL = api.defaults.baseURL || "";
  const response = await fetch(
    `${baseURL}/chats/${encodeURIComponent(data.chatId)}/messages/${encodeURIComponent(data.messageId)}/rewrite/stream`,
    {
      method: "POST",
      headers: await getStreamHeaders(),
      body: JSON.stringify({
        message: data.message,
      }),
    }
  );

  return readMessageStreamResponse(response, "Failed to edit message", onStatus);
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

// Mark messages as read
export async function markMessagesAsRead(
  api: AxiosInstance,
  chatId: string,
  messageIds: string[]
): Promise<void> {
  await api.post(`/chats/${chatId}/messages/mark-read`, { messageIds });
}

// Clear all coach chat history and memory
export async function clearCoachHistory(api: AxiosInstance): Promise<void> {
  await api.delete("/ai/coach/history");
}

// Clear only supermemory (keeps chat history)
export async function clearCoachMemory(api: AxiosInstance): Promise<void> {
  await api.delete("/ai/coach/memory");
}
