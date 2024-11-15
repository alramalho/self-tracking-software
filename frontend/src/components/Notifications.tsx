import React from "react";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { Check, X, MessageSquare, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import posthog from "posthog-js";

interface NotificationsProps {}

const Notifications: React.FC<NotificationsProps> = () => {
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const router = useRouter();
  const api = useApiWithAuth();

  const handleNotificationAction = async (
    notification: Notification,
    action: string
  ) => {
    const concludeNotification = async () => {
      await api.post(`/conclude-notification/${notification.id}`);
      userDataQuery.refetch();
    };

    const actionPromise = async () => {
      if (notification.type === "info") {
        if (action === "dismiss") {
          await concludeNotification();
        }
        await concludeNotification();
      } else if (notification.type === "engagement") {
        if (action === "respond") {
          posthog.capture("engagement-notification-responded", {
            notification_id: notification.id,
          });
          router.push(`/ai?notificationId=${notification.id}`);
        }
        await concludeNotification();
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

  return (
    <>
      {userData && userData.notifications && userData.notifications.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>

          {userData?.notifications &&
            userData.notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-gray-100 shadow-sm border border-gray-200 bg-opacity-50 backdrop-blur-sm p-4 rounded-full flex items-center justify-between transition-shadow duration-200 hover:shadow-md mb-4"
              >
                <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3 ">
                  {["friend_request", "plan_invitation", "info"].includes(
                    notification.type
                  ) &&
                    hasPictureData(notification) && (
                      <Link
                        href={`/profile/${notification.related_data!.username}`}
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
                      <p className="text-sm text-gray-700">{notification.message}</p>
                    </Link>
                  ) : (
                    <p className="text-sm text-gray-700">{notification.message}</p>
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
