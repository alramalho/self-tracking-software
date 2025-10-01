import { type Notification } from "@tsw/prisma";
import { type AxiosInstance } from "axios";
import { normalizeApiResponseArray } from "../../utils/dateUtils";

type NotificationApiResponse = Omit<
  Notification,
  "createdAt" | "processedAt" | "concludedAt" | "sentAt"
> & {
  createdAt: string;
  processedAt: string;
  concludedAt: string;
  sentAt: string;
};

export async function getNotifications(api: AxiosInstance) {
  const response = await api.get<NotificationApiResponse[]>("/notifications");
  return normalizeApiResponseArray<Notification>(response.data, [
    "createdAt",
    "processedAt",
    "concludedAt",
    "sentAt",
  ]);
}
