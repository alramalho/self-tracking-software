"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Bell, Link, Loader2, LogOut, Settings, UserPlus } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import ActivitiesRenderer from "@/components/ActivitiesRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import AppleLikePopover from "@/components/AppleLikePopover";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { format, parseISO, differenceInDays } from "date-fns";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const ProfilePage: React.FC = () => {
  const { clearNotifications } = useNotifications();
  const { signOut } = useClerk();
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const { userData, fetchUserData, loading } = useUserPlan();
  const params = useParams();
  const username = params.username as string;
  const currentUser = userData["me"]?.user;
  const isOwnProfile = currentUser?.username === username || username === "me";
  const profileData = isOwnProfile ? userData["me"] : userData[username];

  useEffect(() => {
    if (!profileData) {
      fetchUserData(isOwnProfile ? "me" : username);
    }
  }, [username, fetchUserData, isOwnProfile, profileData]);

  useEffect(() => {
    if (isOwnProfile) {
      clearNotifications();
    }
  }, [isOwnProfile, clearNotifications]);

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        try {
          await requestPermission();
          toast.success("Permission for push notifications was granted");
        } catch (error) {
          toast.error("Failed to request permission for push notifications");
          console.error(
            "Failed to request permission for push notifications:",
            error
          );
        }
      }
    } else {
      setIsPushGranted(false);
    }
  };

  const photosWithDetails = useMemo(() => {
    if (!profileData) return [];
    const now = new Date();
    const { activityEntries, activities } = profileData;
    return activityEntries
      .filter(
        (entry) =>
          entry.image?.url &&
          entry.image?.created_at &&
          entry.image?.expires_at &&
          entry.image?.keep_in_profile
      )
      .map((entry) => {
        const expiresAt = parseISO(entry.image.expires_at!);
        const daysUntilExpiration = differenceInDays(expiresAt, now);
        const activity = activities.find((a) => a.id === entry.activity_id);
        const activityEntry = activityEntries.find(
          (a) => a.id === entry.activity_id
        );
        return {
          ...entry,
          activityTitle: activity?.title || "Unknown Activity",
          activityEntryQuantity: activityEntry?.quantity || 0,
          activityMeasure: activity?.measure || "",
          formattedDate: format(parseISO(entry.date), "HH:mm"),
          daysUntilExpiration:
            daysUntilExpiration > 0 ? daysUntilExpiration : 0,
        };
      })
      .filter((photo) => photo.daysUntilExpiration > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profileData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center min-h-screen p-4">
        <div className="w-full max-w-3xl">
          <Loader2 className="w-20 h-20 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return <div>No profile data available.</div>;
  }

  const user = profileData.user;

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.picture} alt={user?.name || ""} />
            <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {user?.friend_ids?.length || 0}
            </p>
            <p className="text-sm text-gray-500">Friends</p>
          </div>
          {isOwnProfile ? (
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
              <Button variant="ghost" onClick={() => {
                signOut();
              }}>
                <LogOut size={24} className="cursor-pointer" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="flex items-center space-x-2">
              <UserPlus size={20} />
              <span>Add Friend</span>
            </Button>
          )}
        </div>

        {showUserProfile && isOwnProfile && (
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
            <ActivitiesRenderer
              activities={profileData.activities}
              activityEntries={profileData.activityEntries}
            />
          </TabsContent>
          <TabsContent value="photos">
            {photosWithDetails.length > 0 ? (
              <div className="space-y-4">
                {photosWithDetails.map((photo) => (
                  <div
                    key={photo.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <img
                      src={photo.image.url}
                      alt={photo.activityTitle}
                      className="w-full h-full aspect-square object-contain"
                    />
                    <div className="p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage
                              src={user?.picture}
                              alt={user?.name || ""}
                            />
                            <AvatarFallback>
                              {(user?.name || "U")[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">
                            {photo.activityTitle} – {photo.activityEntryQuantity}{" "}
                            {photo.activityMeasure}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {photo.formattedDate}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        Expires in {photo.daysUntilExpiration} days
                      </span>
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
