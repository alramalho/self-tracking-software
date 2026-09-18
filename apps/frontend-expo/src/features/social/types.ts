import type { Person } from "@/core/types";
export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  body?: string;
  status: string;
  type: string;
  relatedId?: string;
  data?: { senderId?: string; invitationId?: string; url?: string };
}
export type { Chat, Message } from "@/features/messages/types";
