"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Bell, Settings, X } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import ActivitiesRenderer from "@/components/ActivitiesRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import AppleLikePopover from "@/components/AppleLikePopover";

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        try {
          await requestPermission();
          toast.success("Permission for push notifications was granted");
        } catch (error) {
          toast.error("Failed to request permission for push notifications");
          console.error(
            "Failed to request permission for push notifications: " + error
          );
        }
        return;
      }
    } else {
      setIsPushGranted(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
            <AvatarFallback>{user?.fullName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-gray-500">Friends</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Bell size={20} />
              <Switch
                checked={isPushGranted}
                onCheckedChange={handleNotificationChange}
              />
            </div>
            <Settings
              size={24}
              className="cursor-pointer"
              onClick={() => setShowUserProfile(true)}
            />
          </div>
        </div>

        {showUserProfile && (
          <AppleLikePopover onClose={() => setShowUserProfile(false)}>
            <div className="max-h-[80vh] overflow-y-auto">
              <UserProfile routing={"hash"} />
            </div>
          </AppleLikePopover>
        )}

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>
          <TabsContent value="activities">
            <ActivitiesRenderer />
          </TabsContent>
          <TabsContent value="photos">
            <div className="text-center text-gray-500 py-8">
              No photos available yet.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
