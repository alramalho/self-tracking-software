"use client";

import React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, User, Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Switch } from "@/components/ui/switch";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { convertApiPlansToPlans, useUserPlan } from "@/contexts/UserPlanContext";
import PlanRenderer from "@/components/PlanRenderer";

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const {
    isAppInstalled,
    sendLocalNotification,
    sendPushNotification,
    isPushGranted,
    setIsPushGranted,
    requestPermission,
    alertSubscriptionEndpoint,
  } = useNotifications();
  const authedApi = useApiWithAuth();
  const { plan, loading, error } = useUserPlan();

  const handleTestLocalNotification = () => {
    sendLocalNotification(
      "Test Local Notification",
      "This is a test localnotification"
    );
  };
  const handleTestPushNotification = () => {
    sendPushNotification(
      "Test Push Notification",
      "This is a test push notification",
      "/next.png",
      "/see"
    );
  };

  const handleRecurrentCheckin = async () => {
    try {
      await authedApi.post("/api/initiate-recurrent-checkin");
      toast.success(
      `Recurrent Checkin initiated.`
    );
    } catch (error) {
      toast.error("Failed to initiate recurrent checkin");
    }
  };

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        await requestPermission();
        return;
      }
    } else {
      setIsPushGranted(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl mb-4">Profile</h1>
      <div className="mb-4">
        <User size={64} className="text-gray-600" />
      </div>
      <p className="mb-2">
        <strong>Name:</strong> {user?.fullName || "N/A"}
      </p>
      <p className="mb-4">
        <strong>Email:</strong>{" "}
        {user?.primaryEmailAddress?.emailAddress || "N/A"}
      </p>
      <div className="flex items-center space-x-2 mb-4">
        <Bell size={20} />
        <span>Notifications</span>
        <Switch
          checked={isPushGranted}
          onCheckedChange={handleNotificationChange}
        />
      </div>
      <div className="flex items-center space-x-2 mb-4">
        <span>App Installed</span>
        <Switch checked={isAppInstalled} disabled />
      </div>
      <button
        onClick={handleRecurrentCheckin}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-green-500 hover:bg-green-600"
        disabled={!isAppInstalled}
      >
        Intitiate Recurrent Checkin
      </button>
      <button
        onClick={handleTestLocalNotification}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-blue-500 hover:bg-blue-600"
        disabled={!isAppInstalled}
      >
        Test Local Notification
      </button>
      <button
        onClick={handleTestPushNotification}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-blue-500 hover:bg-blue-600"
        disabled={!isAppInstalled}
      >
        Test Push Notification
      </button>
      <button
        onClick={alertSubscriptionEndpoint}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-blue-500 hover:bg-blue-600"
        disabled={!isAppInstalled}
      >
        Alert Subscription Endpoint
      </button>
      <button
        onClick={requestPermission}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-blue-500 hover:bg-blue-600"
        disabled={!isAppInstalled}
      >
        Request Permission
      </button>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center mb-8"
      >
        <LogOut size={20} className="mr-2" />
        Sign Out
      </button>

    </div>
  );
};

export default ProfilePage;