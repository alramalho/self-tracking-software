import React from "react";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { Check, X, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";

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
      if (notification.type === "info") {
        if (action === "dismiss") {
          await concludeNotification();
        }
        await concludeNotification();
      } else if (notification.type === "engagement") {
        if (action === "respond") {
          router.push(`/ai?notificationId=${notification.id}`);
        }
        await concludeNotification();
      } else if (notification.type === "plan_invitation") {
        if (action === "accept") {
          const invitationId = notification.related_id;
          router.push(`/join-plan/${invitationId}`);
        } else if (action === "reject") {
          await api.post(`/reject-plan-invitation/${notification.related_id}`);
        }
        await concludeNotification();
      } else {
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
  }

  return (
    <div className="space-y-4 mb-6">
      <h2 className="text-lg font-semibold mb-4">Notifications</h2>
      {userData["me"]?.notifications.length === 0 && (
        <p className="text-gray-500">No notifications yet.</p>
      )}
      {userData["me"]?.notifications && userData["me"].notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-gray-100 shadow-sm border border-gray-200 bg-opacity-50 backdrop-blur-sm p-4 rounded-full flex items-center justify-between transition-shadow duration-200 hover:shadow-md"
        >
          <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3 ">
            {["friend_request", "plan_invitation", "info"].includes(
              notification.type
            ) &&
              hasPictureData(notification) && (
                <Link href={`/profile/${notification.related_data!.username}`}>
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
              <Link href={`/profile/${notification.related_data!.username}`}>
                <p className="text-gray-700">{notification.message}</p>
              </Link>
            ) : (
              <p className="text-gray-700 ml-4">{notification.message}</p>
            )}
          </div>
          <div className="flex ml-4">{renderActionButtons(notification)}</div>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
