"use client";

import React, { useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { Bell, Settings } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import ActivitiesRenderer from "@/components/ActivitiesRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import AppleLikePopover from "@/components/AppleLikePopover";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { format, parseISO } from "date-fns";

const ProfilePage: React.FC = () => {
  const { user: clerkUser } = useUser();
  const { isPushGranted, setIsPushGranted, requestPermission } = useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const { activityEntries, activities } = useUserPlan();

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

  const photosWithDetails = useMemo(() => {
    return activityEntries
      .filter(entry => entry.image_s3_path)
      .map(entry => ({
        ...entry,
        activityTitle: activities.find(a => a.id === entry.activity_id)?.title || 'Unknown Activity',
        formattedDate: format(parseISO(entry.date), "HH:mm")
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activityEntries, activities]);

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <Avatar className="w-20 h-20">
            <AvatarImage src={clerkUser?.imageUrl} alt={clerkUser?.fullName || ""} />
            <AvatarFallback>{clerkUser?.fullName?.[0] || "U"}</AvatarFallback>
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
            {photosWithDetails.length > 0 ? (
              <div className="space-y-4">
                {photosWithDetails.map((photo) => (
                  <div key={photo.id} className="border rounded-lg overflow-hidden">
                    <img 
                      src={photo.image_s3_path} 
                      alt={photo.activityTitle} 
                      className="w-full h-64 object-cover"
                    />
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={clerkUser?.imageUrl} alt={clerkUser?.fullName || ""} />
                          <AvatarFallback>{clerkUser?.fullName?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{photo.activityTitle}</span>
                      </div>
                      <span className="text-sm text-gray-500">{photo.formattedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No photos available yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
