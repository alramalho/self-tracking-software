import React, { useEffect } from "react";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { Check, X, MessageSquare, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import posthog from "posthog-js";
import { Remark } from "react-remark";

interface NotificationsProps {}

const Notifications: React.FC<NotificationsProps> = () => {
  const { useUserDataQuery, refetchUserData, notificationsData } =
    useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const router = useRouter();
  const api = useApiWithAuth();

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
      if (notification.type === "info") {
        if (action === "dismiss") {
          await concludeNotification();
        }
        await concludeNotification();
      } else if (notification.type === "engagement") {
        if (action === "respond") {
          posthog.capture("engagement-notification-interacted", {
            notification_id: notification.id,
          });
          skipToast = true;
          if (
            notification.related_data &&
            notification.related_data.message_id &&
            notification.related_data.message_text
          ) {
            router.push(
              `/ai?messageId=${notification.related_data.message_id}&messageText=${notification.related_data.message_text}`
            );
          } else {
            toast.error(
              "Something went wrong. Please be so kind and open a bug report."
            );
          }
        }
        await concludeNotification(skipToast);
      } else if (notification.type === "plan_invitation") {
        router.push(`/join-plan/${notification.related_id}`);
      } else if (notification.type === "friend_request") {
        await api.post(
          `/${action}-${notification.type.replace("_", "-")}/${
            notification.related_id
          }`
        );
        await concludeNotification();
      }
    };

    if (!skipToast) {
      toast.promise(actionPromise(), {
        loading: `Processing ${notification.type.replace("_", " ")}...`,
        success: `${notification.type
          .replace("_", " ")
          .charAt(0)
          .toUpperCase()}${notification.type
          .replace("_", " ")
          .slice(1)} ${action}ed successfully!`,
        error: `Failed to ${action} ${notification.type.replace("_", " ")}`,
      });
    }
  };

  const renderActionButtons = (notification: Notification) => {
    const buttonClasses =
      "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
    const iconSize = 20;

    switch (notification.type) {
      case "friend_request":
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
      case "plan_invitation":
        return (
          <button
            onClick={() => handleNotificationAction(notification, "view")}
            className={`${buttonClasses} bg-blue-100 text-blue-600 hover:bg-blue-200`}
            aria-label="View"
          >
            <Eye size={iconSize} />
          </button>
        );
      case "engagement":
        return (
          <>
            <button
              onClick={() => handleNotificationAction(notification, "respond")}
              className={`${buttonClasses} bg-blue-100 text-blue-600 hover:bg-blue-200`}
              aria-label="Respond"
            >
              <MessageSquare size={iconSize} />
            </button>
            <button
              onClick={() => handleNotificationAction(notification, "dismiss")}
              className={`${buttonClasses} bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2`}
              aria-label="Dismiss"
            >
              <X size={iconSize} />
            </button>
          </>
        );
      case "info":
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
      default:
        return null;
    }
  };

  const hasPictureData = (notification: Notification) => {
    return notification.related_data && notification.related_data.name;
  };

  const handleClearAll = async () => {
    const clearPromise = async () => {
      await api.post("/clear-all-notifications");
      notificationsData.refetch();
    };

    toast.promise(clearPromise(), {
      loading: "Clearing all notifications...",
      success: "All notifications cleared!",
      error: "Failed to clear notifications",
    });
  };

  return (
    <>
      {notificationsData &&
        notificationsData.data &&
        notificationsData.data.notifications &&
        notificationsData.data.notifications.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button
                onClick={handleClearAll}
                className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200"
              >
                Clear All
              </button>
            </div>

            {notificationsData.data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white shadow-sm border border-gray-200 bg-opacity-50 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 mb-4"
                >
                  <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3 ">
                    {["friend_request", "plan_invitation", "info"].includes(
                      notification.type
                    ) &&
                      hasPictureData(notification) && (
                        <Link
                          href={`/profile/${
                            notification.related_data!.username
                          }`}
                        >
                          <Avatar>
                            <AvatarImage
                              src={notification.related_data!.picture}
                              alt={notification.related_data!.name || ""}
                            />
                            <AvatarFallback>
                              {(notification.related_data!.name || "U")[0]}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      )}
                    {["engagement"].includes(notification.type) && (
                      <p className="text-4xl text-gray-700 font-medium">💭</p>
                    )}
                    {hasPictureData(notification) ? (
                      <Link
                        href={`/profile/${notification.related_data!.username}`}
                      >
                        <p className="text-sm text-gray-700">
                          <div className="markdown">
                            <Remark>{notification.message}</Remark>
                          </div>
                        </p>
                      </Link>
                    ) : (
                      <p className="text-sm text-gray-700">
                        <div className="markdown">
                          <Remark>{notification.message}</Remark>
                        </div>
                      </p>
                    )}
                  </div>
                  <div className="flex ml-4">
                    {renderActionButtons(notification)}
                  </div>
                </div>
              ))}
          </>
        )}
    </>
  );
};

export default Notifications;
