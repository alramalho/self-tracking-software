"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Bell,
  Check,
  Loader2,
  LogOut,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
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
import { useApiWithAuth } from "@/api";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";

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
  const currentUserFriendRequests = userData["me"]?.friendRequests;
  const isOwnProfile = currentUser?.username === username || username === "me";
  const profileData = isOwnProfile ? userData["me"] : userData[username];
  const { activityEntries, activities } = profileData;
  const api = useApiWithAuth();

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

  const handleSendFriendRequest = async () => {
    if (profileData && profileData.user) {
      try {
        await api.post(`/api/send-friend-request/${profileData.user.id}`);

        // Update the local state to reflect the sent friend request
        fetchUserData();
        toast.success("Friend request sent successfully");
      } catch (error) {
        console.error("Error sending friend request:", error);
        toast.error("Failed to send friend request");
      }
    }
  };

  const handleFriendRequest = async (action: "accept" | "reject") => {
    if (profileData && profileData.user) {
      try {
        const request = currentUserFriendRequests?.find(
          (req) => req.sender_id === profileData.user?.id && req.status === "pending"
        );
        if (request) {
          await api.post(`/api/friend-requests/${request.id}/${action}`);
          toast.success(`Friend request ${action}ed`);
          fetchUserData();
        }
      } catch (error) {
        console.error(`Error ${action}ing friend request:`, error);
        toast.error(`Failed to ${action} friend request`);
      }
    }
  };

  const photosWithDetails = useMemo(() => {
    if (!profileData) return [];
    const now = new Date();
    return activityEntries
      .filter(
        (entry) =>
          entry.image?.url &&
          entry.image?.created_at &&
          entry.image?.expires_at &&
          new Date(entry.image.expires_at!) > now &&
          entry.image?.keep_in_profile
      )
      .map((entry) => {
        const expiresAt = parseISO(entry.image.expires_at!);
        const daysUntilExpiration = differenceInDays(expiresAt, now);
        const activity = activities.find((a) => a.id === entry.activity_id);

        return {
          ...entry,
          activityTitle: activity?.title || "Unknown Activity",
          activityEmoji: activity?.emoji || "",
          activityEntryQuantity: entry?.quantity || 0,
          activityMeasure: activity?.measure || "",
          formattedDate: format(parseISO(entry.date), "HH:mm"),
          daysUntilExpiration:
            daysUntilExpiration > 0 ? daysUntilExpiration : 0,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profileData]);

  const pendingFriendRequests = currentUserFriendRequests?.filter(
    (request) => request.status === "pending" && request.recipient_id === currentUser?.id
  );

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
            <AvatarImage src={user?.picture || ""} alt={user?.name || ""} />
            <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {user?.friend_ids?.length || 0}
            </p>
            <p className="text-sm text-gray-500">Friends</p>
            {pendingFriendRequests?.length > 0 && (
              <Link href="/friend-requests">
                <Badge variant="secondary" className="cursor-pointer bg-red-500 text-white">
                  {pendingFriendRequests?.length || 0} Requests
                  </Badge>
                </Link>
              )}
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
              <Button
                variant="ghost"
                onClick={() => {
                  signOut();
                }}
              >
                <LogOut size={24} className="cursor-pointer" />
              </Button>
            </div>
          ) : (
            <>
              {currentUserFriendRequests?.some(
                (request) =>
                  request.sender_id === profileData.user?.id &&
                  request.status === "pending"
              ) ? (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => handleFriendRequest("accept")}
                  >
                    <Check size={20} />
                    <span>Accept</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => handleFriendRequest("reject")}
                  >
                    <X size={20} />
                    <span>Reject</span>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={handleSendFriendRequest}
                  disabled={currentUserFriendRequests?.some(
                    (request) => request.recipient_id === profileData.user?.id
                  )}
                >
                  {currentUserFriendRequests?.some(
                    (request) => request.recipient_id === profileData.user?.id
                  ) ? (
                    <Check size={20} />
                  ) : (
                    <UserPlus size={20} />
                  )}
                  <span>
                    {currentUserFriendRequests?.some(
                      (request) => request.recipient_id === profileData.user?.id
                    )
                      ? "Request Sent"
                      : "Add Friend"}
                  </span>
                </Button>
              )}
            </>
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
                  <ActivityEntryPhotoCard
                    key={photo.id}
                    imageUrl={photo.image.url!}
                    activityTitle={photo.activityTitle}
                    activityEmoji={photo.activityEmoji}
                    activityEntryQuantity={photo.activityEntryQuantity}
                    activityMeasure={photo.activityMeasure}
                    formattedDate={photo.formattedDate}
                    daysUntilExpiration={photo.daysUntilExpiration}
                    userPicture={user?.picture} 
                    userName={user?.name}
                    userUsername={user?.username}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {activityEntries.length === 0 ? "No activities available yet." : `${user?.name}'s ${activities.length} past activities photos have expired.`}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
