import type { AppNotification } from "@/features/social/types";

export function notificationTarget(notification: AppNotification): string | null {
  const data = notification.relatedData;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return notification.type === "COACH" && notification.relatedId
      ? `/chat/${encodeURIComponent(notification.relatedId)}`
      : null;
  const value = data as Record<string, unknown>;
  if (typeof value.url === "string") return value.url;
  if (typeof value.activityEntryId === "string")
    return `/?activityEntryId=${encodeURIComponent(value.activityEntryId)}`;
  if (typeof value.achievementPostId === "string")
    return `/?achievementPostId=${encodeURIComponent(value.achievementPostId)}`;
  if (typeof value.chatId === "string")
    return `/chat/${encodeURIComponent(value.chatId)}`;
  if (notification.type === "PLAN_INVITATION")
    return null;
  if (typeof value.planId === "string")
    return `/plan/${encodeURIComponent(value.planId)}`;
  if (notification.type === "COACH" && notification.relatedId)
    return `/chat/${encodeURIComponent(notification.relatedId)}`;
  const username = value.username ?? value.userUsername;
  return typeof username === "string"
    ? `/profile/${encodeURIComponent(username)}`
    : null;
}
