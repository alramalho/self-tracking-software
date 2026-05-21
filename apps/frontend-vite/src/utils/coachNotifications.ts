import { type Notification } from "@tsw/prisma";

const AUTONOMOUS_COACH_PROMPT_TAG = "autonomous_coach";

export function getPendingCoachActionCount(notification: Notification): number {
  const relatedData = notification.relatedData as any;
  const pendingActionCount = relatedData?.pendingActionCount;

  return typeof pendingActionCount === "number" ? pendingActionCount : 0;
}

export function getPendingCoachActionNotifications(
  notifications: Notification[] | undefined
) {
  return (
    notifications?.filter(
      (notification) =>
        notification.type === "COACH" &&
        !notification.concludedAt &&
        notification.promptTag === AUTONOMOUS_COACH_PROMPT_TAG &&
        getPendingCoachActionCount(notification) > 0
    ) ?? []
  );
}

