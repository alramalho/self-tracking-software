import { type AxiosInstance } from "axios";
import { normalizeApiResponse } from "@/utils/dateUtils";

export interface UserContextEvent {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  occurredAt: Date | null;
  endedAt: Date | null;
  source: "USER_REPORTED" | "COACH_INFERRED" | "USER_CONFIRMED";
  sourceMessageId: string | null;
  confidence: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type UserContextEventApiResponse = Omit<
  UserContextEvent,
  "occurredAt" | "endedAt" | "createdAt" | "updatedAt" | "deletedAt"
> & {
  occurredAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const deserializeUserContextEvent = (
  event: UserContextEventApiResponse,
): UserContextEvent =>
  normalizeApiResponse<UserContextEvent>(event, [
    "occurredAt",
    "endedAt",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ]);

export async function getContextEvents(api: AxiosInstance) {
  const response = await api.get<{ events: UserContextEventApiResponse[] }>(
    "/context-events",
  );

  return response.data.events.map(deserializeUserContextEvent);
}
