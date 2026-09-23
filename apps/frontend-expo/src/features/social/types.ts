import type { Person } from "@/core/types";
export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  status: string;
  type: string;
  relatedId?: string;
  relatedData?: Record<string, unknown> | null;
}
export type { Chat, Message } from "@/features/messages/types";
