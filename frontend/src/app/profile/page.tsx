"use client";

import React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, User, Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Switch } from "@/components/ui/switch";

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const {
    isAppInstalled,
    setupPeriodicSync,
    triggerPeriodicSync,
    sendNotification,
    isPushGranted,
    isPeriodicSyncEnabled,
    cancelPeriodicSync,
    requestPermission,
    alertSubscriptionEndpoint,
  } = useNotifications();

  const handleTestNotification = () => {
    sendNotification("Test Notification", {
      body: "This is a test notification",
    });
  };

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        await requestPermission();
        return
      }

      await setupPeriodicSync();
    } else {
      try {
        await cancelPeriodicSync();
      } catch (error) {
        alert("Error canceling periodic sync:" + error);
      }
    }
  };

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
          checked={isAppInstalled && isPushGranted && isPeriodicSyncEnabled}
          onCheckedChange={handleNotificationChange}
        />
      </div>
      <div className="flex items-center space-x-2 mb-4">
        <span>App Installed</span>
        <Switch checked={isAppInstalled} disabled />
      </div>
      <button
        onClick={triggerPeriodicSync}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-purple-500 hover:bg-purple-600"
        disabled={!isAppInstalled}
      >
        Test Periodic Sync
      </button>
      <button
        onClick={handleTestNotification}
        className="px-4 py-2 text-white rounded transition-colors flex items-center mb-4 bg-blue-500 hover:bg-blue-600"
        disabled={!isAppInstalled}
      >
        Test Notification
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
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center"
      >
        <LogOut size={20} className="mr-2" />
        Sign Out
      </button>
    </div>
  );
};

export default ProfilePage;
