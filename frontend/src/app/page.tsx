"use client";

import React, { useState, useEffect } from "react";
import PlansRenderer from "@/components/PlansRenderer";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useUserPlan, Notification } from "@/contexts/UserPlanContext";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ChevronRight, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { userData, setUserData, fetchUserData } = useUserPlan();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const api = useApiWithAuth();

  useEffect(() => {
    if (userData && userData["me"] && userData["me"].plans.length == 0) {
      router.push("/onboarding");
    }
  }, [userData]);

  const removeNotification = (notificationId: string) => {
    setUserData("me", {
      ...userData["me"],
      notifications: userData["me"].notifications.filter(
        (n) => n.id !== notificationId
      ),
    });
  };

  const handleNotificationAction = async (
    notification: Notification,
    action: string
  ) => {
    const actionPromise = async () => {
      if (action === "accept" || action === "reject") {
        // Handle friend request or plan invitation
        await api.post(
          `/${action}-${notification.type.replace("_", "-")}/${
            notification.related_id
          }`
        );
      } else if (action === "respond") {
        // Forward to AI page
        router.push(`/ai?notificationId=${notification.id}`);
      }
      // Conclude the notification
      await api.post(`/conclude-notification/${notification.id}`);
      // Refresh user data to update notifications
      removeNotification(notification.id);
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

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-3xl font-light text-gray-800 mb-6">
          welcome to self.tracking.so
        </h1>
        <Link
          href="/signin"
          className="bg-black text-white font-normal py-2 px-6 rounded hover:bg-gray-800 transition-colors duration-200"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!userData || !userData["me"]) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="ml-3">Loading your data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {userData["me"].user?.name ? `, ${userData["me"].user.name}` : ""}
      </h1>

      {/* Render notifications */}
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

      <div
        className="bg-white border-2 border-gray-200 p-4 rounded-lg mb-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between shadow-md hover:shadow-lg"
        onClick={() => setIsPopoverOpen(true)}
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={userData["me"].user?.picture} alt="User Avatar" />
            <AvatarFallback>
              {userData["me"].user?.name?.[0] ||
                userData["me"].user?.username?.[0] ||
                "U"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-semibold">Your plans</h2>
          <ChevronRight
            className={`transition-transform duration-300 ${
              isPopoverOpen ? "rotate-90" : ""
            } text-gray-500`}
            size={24}
          />
        </div>
      </div>

      <h1 className="text-lg font-bold mb-4">Last week</h1>
      <TimelineRenderer />

      {isPopoverOpen && (
        <AppleLikePopover onClose={() => setIsPopoverOpen(false)}>
          <PlansRenderer />
        </AppleLikePopover>
      )}
    </div>
  );
};

export default HomePage;
