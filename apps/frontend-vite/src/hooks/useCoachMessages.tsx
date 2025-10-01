import { useDataNotifications } from "@/contexts/notifications";
import { type CompletePlan } from "@/contexts/plans";

interface CoachMessage {
  message: string;
  createdAt: Date;
}

export const useCoachMessages = () => {
  const { notifications } = useDataNotifications();

  const getLastCoachMessage = (): CoachMessage | null => {
    if (!notifications) return null;

    // Find the most recent coach notification
    const coachNotifications = notifications
      .filter((notification) => notification.type === "COACH")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (coachNotifications.length === 0) return null;

    const lastCoachNotification = coachNotifications[0];
    return {
      message: lastCoachNotification.message,
      createdAt: new Date(lastCoachNotification.createdAt),
    };
  };

  const shouldUseCoachMessage = (plan: CompletePlan): boolean => {
    // Use coach message instead of coach notes for active plans (not COMPLETED or FAILED)
    return plan.currentWeekState !== "COMPLETED" && plan.currentWeekState !== "FAILED";
  };

  return {
    getLastCoachMessage,
    shouldUseCoachMessage,
  };
};