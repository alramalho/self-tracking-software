import React from "react";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { Check, X, MessageSquare } from "lucide-react";

interface NotificationsProps {}

const Notifications: React.FC<NotificationsProps> = () => {
  const { userData, fetchUserData } = useUserPlan();
  const router = useRouter();
  const api = useApiWithAuth();

  const handleNotificationAction = async (
    notification: Notification,
    action: string
  ) => {
    const concludeNotification = async () => {
      await api.post(`/conclude-notification/${notification.id}`);
      await fetchUserData({ forceUpdate: true });
    };

    const actionPromise = async () => {
      if (action === "accept" || action === "reject") {
        await api.post(
          `/${action}-${notification.type.replace("_", "-")}/${
            notification.related_id
          }`
        );
        await concludeNotification();
      } else if (action === "respond") {
        await concludeNotification();
        router.push(`/ai?notificationId=${notification.id}`);
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
    const buttonClasses = "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
    const iconSize = 20;

    switch (notification.type) {
      case "friend_request":
      case "plan_invitation":
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
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {userData["me"].notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white shadow-sm border border-gray-200 p-4 rounded-lg flex items-center justify-between transition-shadow duration-200 hover:shadow-md"
        >
          <p className="text-gray-700">{notification.message}</p>
          <div className="flex ml-4">
            {renderActionButtons(notification)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
