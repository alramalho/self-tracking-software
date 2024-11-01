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
import { convertApiPlanToPlan, User, useUserPlan } from "@/contexts/UserPlanContext";
import { format, parseISO, differenceInDays } from "date-fns";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { Input } from "@/components/ui/input";
import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";

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
  const currentUserSentFriendRequests = userData["me"]?.sentFriendRequests;
  const currentUserReceivedFriendRequests =
    userData["me"]?.receivedFriendRequests;
  const isOwnProfile = currentUser?.username === username || username === "me";
  const profileData = isOwnProfile ? userData["me"] : userData[username];
  const { activityEntries, activities } = profileData || {
    activityEntries: [],
    activities: [],
  };
  const api = useApiWithAuth();
  const [showEditActivityEntry, setShowEditActivityEntry] = useState<
    string | null
  >(null);

  const isOnesOwnProfile =
    currentUser?.username === username || username === "me";

  useEffect(() => {
    if (!profileData) {
      fetchUserData({ username: isOwnProfile ? "me" : username });
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
        await api.post(`/send-friend-request/${profileData.user.id}`);

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
        const request = currentUserReceivedFriendRequests?.find(
          (req) =>
            req.sender_id === profileData.user?.id && req.status === "pending"
        );
        if (request) {
          await api.post(`${action}-friend-request/${request.id}`);
          toast.success(`Friend request ${action}ed`);
          fetchUserData();
        }
      } catch (error) {
        console.error(`Error ${action}ing friend request:`, error);
        toast.error(`Failed to ${action} friend request`);
      }
    }
  };
  const getFormattedDate = (date: string) => {
    const parsedDate = parseISO(date);
    const now = new Date();
    const diffInDays = differenceInDays(now, parsedDate);

    if (diffInDays === 1) {
      return `yesterday at ${format(parsedDate, "HH:mm")}`;
    }

    if (diffInDays <= 7) {
      return `last ${format(parsedDate, "EEEE")} at ${format(
        parsedDate,
        "HH:mm"
      )}`;
    }

    return format(parsedDate, "MMM d HH:mm");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading profile</p>
      </div>
    );
  }

  if (!profileData) {
    return <div>No profile data available.</div>;
  }

  const user = profileData.user;

  const getUsername = (user: User | null) => {
    return user?.username === userData["me"]?.user?.username
      ? "me"
      : user?.username;
  };

  const hasPendingReceivedFriendRequest = () => {
    return currentUserReceivedFriendRequests?.some(
      (request) =>
        request.sender_id === profileData.user?.id &&
        request.status === "pending"
    );
  };

  const hasPendingSentFriendRequest = () => {
    return currentUserSentFriendRequests?.some(
      (request) =>
        request.recipient_id === profileData.user?.id &&
        request.status === "pending"
    );
  };

  const isFriend = () => {
    return currentUser?.friend_ids?.includes(profileData.user?.id || "");
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-around gap-4 items-center mb-8">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.picture || ""} alt={user?.name || ""} />
            <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
          </Avatar>
          <Link href={`/friends/${getUsername(user)}`}>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {user?.friend_ids?.length || 0}
              </p>
              <p className="text-sm text-gray-500">Friends</p>
            </div>
          </Link>
          {isOwnProfile && (
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
          )}
          {!isOwnProfile && !isFriend() && (
            <>
              {hasPendingReceivedFriendRequest() && (
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
              )}
              <Button
                variant="outline"
                className="flex items-center space-x-2"
                onClick={handleSendFriendRequest}
                disabled={hasPendingSentFriendRequest()}
              >
                {hasPendingSentFriendRequest() ? (
                  <>
                    <Check size={20} />
                    <span>Request Sent</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    <span>Add Friend</span>
                  </>
                )}
              </Button>
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

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="space-y-4">
              {profileData.plans?.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-lg bg-white">
                  <div className="flex flex-row items-center gap-2 mb-4">
                    <span className="text-4xl">{plan.emoji}</span>
                    <h3 className="text-lg font-semibold">{plan.goal}</h3>
                  </div>
                  <PlanActivityEntriesRenderer plan={convertApiPlanToPlan(plan, activities)} activities={activities} activityEntries={activityEntries} />
                </div>
              ))}
              {(!profileData.plans || profileData.plans.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  No active plans available.
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="history">
            {activityEntries?.length > 0 ? (
              <div className="space-y-4">
                {activityEntries
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((entry) => {
                    const activity = activities.find(
                      (a) => a.id === entry.activity_id
                    );
                    return (
                      <ActivityEntryPhotoCard
                        key={entry.id}
                        imageUrl={entry.image?.url}
                        activityTitle={activity?.title || "Unknown Activity"}
                        activityEmoji={activity?.emoji || ""}
                        activityEntryQuantity={entry.quantity}
                        activityMeasure={activity?.measure || ""}
                        formattedDate={getFormattedDate(entry.date)}
                        daysUntilExpiration={
                          entry.image?.expires_at
                            ? differenceInDays(
                                parseISO(entry.image.expires_at!),
                                new Date()
                              )
                            : 0
                        }
                        userPicture={user?.picture}
                        userName={user?.name}
                        userUsername={user?.username}
                        editable={isOnesOwnProfile}
                        onEditClick={() => {
                          setShowEditActivityEntry(entry.id);
                        }}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {activityEntries?.length === 0
                  ? "No activities available yet."
                  : `${user?.name}'s ${activities.length} past activities photos have expired.`}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {showEditActivityEntry && isOnesOwnProfile && (
        <ActivityEntryEditor
          activityEntry={
            activityEntries.find((entry) => entry.id === showEditActivityEntry)!
          }
          onClose={() => setShowEditActivityEntry(null)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
