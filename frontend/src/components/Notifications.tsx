import React from "react";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";

interface NotificationsProps {
}

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
      await fetchUserData({forceUpdate: true});
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

  return (
    <>
      {userData["me"].notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white border-2 border-gray-200 p-4 rounded-lg mb-4 shadow-md"
        >
          <p>{notification.message}</p>
          {notification.type === "friend_request" && (
            <div className="mt-2">
              <button
                onClick={() =>
                  handleNotificationAction(notification, "accept")
                }
                className="mr-2 bg-green-500 text-white px-3 py-1 rounded"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  handleNotificationAction(notification, "reject")
                }
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Reject
              </button>
            </div>
          )}
          {notification.type === "plan_invitation" && (
            <div className="mt-2">
              <button
                onClick={() =>
                  handleNotificationAction(notification, "accept")
                }
                className="mr-2 bg-green-500 text-white px-3 py-1 rounded"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  handleNotificationAction(notification, "reject")
                }
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Reject
              </button>
            </div>
          )}
          {notification.type === "engagement" && (
            <div className="mt-2">
              <button
                onClick={() =>
                  handleNotificationAction(notification, "respond")
                }
                className="mr-2 bg-blue-500 text-white px-3 py-1 rounded"
              >
                Respond
              </button>
              <button
                onClick={() =>
                  handleNotificationAction(notification, "dismiss")
                }
                className="bg-gray-500 text-white px-3 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
};

export default Notifications;
