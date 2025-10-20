import { useDataNotifications } from "@/contexts/notifications";
import { useTheme } from "@/contexts/theme/useTheme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatTimeAgo } from "@/lib/utils";
import { X } from "lucide-react";
import React, { useMemo } from "react";

export const CoachNotificationBanner: React.FC = () => {
  const { notifications } = useDataNotifications();
  const { isDarkMode } = useTheme();
  const [dismissedNotifications, setDismissedNotifications] = useLocalStorage<
    string[]
  >("dismissed-coach-notifications", []);

  // Get the most recent coach notification
  const latestCoachNotification = useMemo(() => {
    return notifications
      ?.filter((n) => n.type === "COACH")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
  }, [notifications]);

  // Don't show if no notification or if it's been dismissed
  if (
    !latestCoachNotification ||
    dismissedNotifications.includes(latestCoachNotification.id)
  ) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedNotifications([
      ...dismissedNotifications,
      latestCoachNotification.id,
    ]);
  };

  const relatedData = latestCoachNotification.relatedData as {
    picture?: string;
  } | null;

  const coachIcon =
    (isDarkMode
      ? "/public/images/jarvis_logo_white_transparent.png"
      : "/public/images/jarvis_logo_transparent.png");

  return (
    <div className="ring-1 ring-border backdrop-blur-md bg-card/30 rounded-3xl py-3 px-4 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <img
            src={coachIcon}
            alt="Oli AI Coach"
            className="w-10 h-10 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            {latestCoachNotification.title && (
              <span className="text-sm font-semibold text-foreground block mb-1">
                {latestCoachNotification.title}
              </span>
            )}
            <p className="text-xs text-foreground/80">
              {latestCoachNotification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTimeAgo(latestCoachNotification.createdAt)}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 hover:bg-muted/50 rounded-full transition-colors duration-200 ml-2 flex-shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};
