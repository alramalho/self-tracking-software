import { fetch } from "expo/fetch";
import { api, backendUrl, getAuthToken } from "@/data/api";
import type { Chat, Message, SendPayload, ResponseState } from "./types";

export const getChats = async () =>
  (await api.get<{ chats: Chat[] }>("/chats")).data.chats;
export const createCoachChat = async () =>
  (await api.post<{ chat: Chat }>("/ai/coach/chats", { title: null })).data
    .chat;
export const getMessages = async (id: string, coach: boolean) =>
  (
    await api.get<{ messages: Message[] }>(
      `/chats/${encodeURIComponent(id)}/messages`,
      { params: coach ? { includeCoachHistory: true } : undefined },
    )
  ).data.messages;
export const chatTitle = (chat: Chat, userId?: string) =>
  chat.title ||
  chat.planGroupName ||
  chat.participants
    ?.filter((p) => p.userId !== userId)
    .map((p) => p.name || p.username || "Member")
    .join(", ") ||
  "Conversation";

// Expo's native fetch streams SSE without buffering the coach's status updates.
export async function sendMessage(
  input: SendPayload,
  onStatus: (status: ResponseState["status"]) => void,
): Promise<Message[]> {
  const path = `/chats/${encodeURIComponent(input.chatId)}/messages`;
  if (!input.coach) {
    const { data } = await api.post(path, {
      message: input.message,
      imageAttachments: input.imageAttachments,
    });
    return data.messages ?? [data.message];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const token = await getAuthToken();
    const response = await fetch(
      `${backendUrl}${path}${input.rewriteId ? `/${encodeURIComponent(input.rewriteId)}/rewrite` : ""}/stream`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planId: input.planId,
          message: input.message,
          imageAttachments: input.imageAttachments,
          coachStarterId: input.coachStarterId,
          coachVersion: "v2",
        }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.error || `Unable to send message (${response.status})`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new Error(
        "The coach connection could not be opened. Please try again.",
      );
    const decoder = new TextDecoder();
    let buffer = "";
    let messages: Message[] | undefined;
    const event = (raw: string) => {
      const lines = raw.split("\n");
      const name = lines
        .find((l) => l.startsWith("event:"))
        ?.slice(6)
        .trim();
      const json = lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!json) return;
      const data = JSON.parse(json);
      if (name === "status") onStatus(data.state);
      if (name === "error")
        throw new Error(
          data.error || "The coach could not respond. Please try again.",
        );
      if (name === "done")
        messages = data.messages ?? (data.message ? [data.message] : []);
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        let index: number;
        while ((index = buffer.indexOf("\n\n")) >= 0) {
          event(buffer.slice(0, index));
          buffer = buffer.slice(index + 2);
        }
        if (done) break;
      }
      if (buffer.trim()) event(buffer);
      if (!messages)
        throw new Error(
          "Connection interrupted. Refresh to check the response before sending again.",
        );
      return messages;
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
  }
}
