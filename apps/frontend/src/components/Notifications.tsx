import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { formatTimeAgo } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { Notification } from "@tsw/prisma";
import { Check, Eye, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import React from "react";
import toast from "react-hot-toast";
import { Remark } from "react-remark";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface NotificationsProps {}

const Notifications: React.FC<NotificationsProps> = () => {
  const { notificationsData } = useUserPlan();
  const router = useRouter();
  const api = useApiWithAuth();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { isPushGranted, requestPermission } = useNotifications();

  const handleNotificationAction = async (
    notification: Notification,
    action: string
  ) => {
    const concludeNotification = async (skipToast: boolean = false) => {
      await api.post(`/conclude-notification/${notification.id}`);
      if (!skipToast) {
        notificationsData.refetch();
      }
    };

    let skipToast = false;
    const actionPromise = async () => {
      if (notification.type === "INFO") {
        await concludeNotification();
      } else if (notification.type === "ENGAGEMENT") {
        if (action === "dismiss") {
          await concludeNotification();
        } else if (action === "respond") {
          posthog.capture("engagement-notification-interacted", {
            notification_id: notification.id,
          });
          skipToast = true;
          if (
            notification.relatedData &&
            (notification.relatedData as any).messageId &&
            (notification.relatedData as any).messageText
          ) {
            router.push(
              `/ai?assistantType=activity-extraction&messageId=${(notification.relatedData as any).messageId}&messageText=${(notification.relatedData as any).messageText}`
            );
          } else {
            toast.error(
              "Something went wrong. Please be so kind and open a bug report."
            );
          }
        }
        await concludeNotification(skipToast);
      } else if (notification.type === "PLAN_INVITATION") {
        router.push(`/join-plan/${notification.relatedId}`);
      } else if (notification.type === "FRIEND_REQUEST") {
        await api.post(
          `/${action}-${notification.type.replace("_", "-")}/${
            notification.relatedId
          }`
        );
        await concludeNotification();
      }
    };

    if (!skipToast) {
      toast.promise(actionPromise(), {
        loading: `Processing ${notification.type.replace("_", " ")}...`,
        success: `${notification.type
          .toLowerCase()
          .replace("_", " ")
          .charAt(0)
          .toUpperCase()}${notification.type
          .replace("_", " ")
          .slice(1)} ${action}ed successfully!`,
        error: `Failed to ${action} ${notification.type.replace("_", " ")}`,
      });
    } else {
      actionPromise();
    }
    notificationsData.refetch();
  };

  const renderActionButtons = (notification: Notification) => {
    const buttonClasses =
      "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
    const iconSize = 20;

    switch (notification.type) {
      case "FRIEND_REQUEST":
        return (
          <>
            <button
              onClick={() => handleNotificationAction(notification, "accept")}
              className={`${buttonClasses} bg-green-100 text-green-600 hover:bg-green-200`}
              aria-label="Accept"
            >
              <Check size={iconSize} />
            </button>
            <button
              onClick={() => handleNotificationAction(notification, "reject")}
              className={`${buttonClasses} bg-red-100 text-red-600 hover:bg-red-200 ml-2`}
              aria-label="Reject"
            >
              <X size={iconSize} />
            </button>
          </>
        );
      case "PLAN_INVITATION":
        return (
          <button
            onClick={() => handleNotificationAction(notification, "view")}
            className={`${buttonClasses} ${variants.fadedBg} ${variants.text} hover:bg-blue-200`}
            aria-label="View"
          >
            <Eye size={iconSize} />
          </button>
        );
      default:
        return (
          <>
            <button
              onClick={() => handleNotificationAction(notification, "dismiss")}
              className={`${buttonClasses} bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2`}
              aria-label="Dismiss"
            >
              <X size={iconSize} />
            </button>
          </>
        );
    }
  };

  const hasPictureData = (notification: Notification) => {
    return notification.relatedData && (notification.relatedData as any).picture;
  };
  const hasUsernameData = (notification: Notification) => {
    return notification.relatedData && (notification.relatedData as any).username;
  };

  const handleClearAll = async () => {
    const clearPromise = async () => {
      await api.post("/notifications/clear-all-notifications");
      notificationsData.refetch();
    };

    toast.promise(clearPromise(), {
      loading: "Clearing all notifications...",
      success: "All notifications cleared!",
      error: "Failed to clear notifications",
    });
  };

  // Get the latest engagement notification
  // const latestEngagementNotification =
  //   notificationsData?.data?.notifications?.find(
  //     (n) => n.type === "ENGAGEMENT"
  //   );

  // Filter out engagement notifications from the regular notifications
  const regularNotifications = notificationsData?.data?.notifications?.filter(
    (n) => n.type !== "ENGAGEMENT"
  );

  const unreadNotifications =
    regularNotifications?.filter((n) => n.status !== "CONCLUDED") || [];

  if (unreadNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="bg-gray-100 p-4 rounded-full mb-4">
          <Check size={48} className="text-gray-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700">All up to date!</h2>
        {!isPushGranted && (
          <p className="text-gray-500 text-sm">
            <button className="underline" onClick={requestPermission}>Click here</button> to be notified of new notifications.
          </p>
        )}
        {isPushGranted && (
          <p className="text-gray-500 text-sm">
            Come back later to see new notifications.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* {latestEngagementNotification && (
        <AINotification
          message={latestEngagementNotification.message}
          createdAt={latestEngagementNotification.createdAt}
          onDismiss={(e) => {
            e.stopPropagation();
            handleNotificationAction(latestEngagementNotification, "dismiss");
          }}
          onClick={() =>
            handleNotificationAction(latestEngagementNotification, "respond")
          }
        />
      )} */}

      {regularNotifications && regularNotifications.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <button
              onClick={handleClearAll}
              className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200"
            >
              Clear All
            </button>
          </div>

          {unreadNotifications.map((notification) => {
            const relatedData = notification.relatedData as {
              username: string;
              picture: string;
              name: string;
            };

            return (
              <div
                key={notification.id}
                className="shadow-sm bg-opacity-50 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 mb-4 bg-white border border-gray-200"
              >
                <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3 ">
                  {[
                      "FRIEND_REQUEST",
                    "PLAN_INVITATION",
                    "INFO",
                    "COACH",
                  ].includes(notification.type) &&
                    hasPictureData(notification) && (
                      <Link href={`/profile/${relatedData.username}`}>
                        <Avatar>
                          <AvatarImage
                            src={relatedData.picture}
                            alt={relatedData.name || ""}
                          />
                          <AvatarFallback>
                            {(relatedData.name || "U")[0]}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    )}
                  {hasUsernameData(notification) ? (
                    <Link href={`/profile/${relatedData.username}`}>
                      <div className="markdown text-sm text-gray-700">
                        <Remark>{notification.message}</Remark>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTimeAgo(notification.createdAt)}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="markdown text-sm text-gray-700">
                      <Remark>{notification.message}</Remark>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex ml-4">
                  {renderActionButtons(notification)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Notifications;
