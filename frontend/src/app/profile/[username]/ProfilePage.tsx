"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Bell,
  ChartArea,
  Check,
  History,
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
import {
  convertApiPlanToPlan,
  User,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import {
  format,
  parseISO,
  differenceInDays,
  endOfMonth,
  endOfYear,
} from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { Input } from "@/components/ui/input";
import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import { usePostHog } from "posthog-js/react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Divider from "@/components/Divider";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";

const ProfilePage: React.FC = () => {
  const { clearNotifications } = useNotifications();
  const { signOut } = useClerk();
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const params = useParams();
  const username = params.username as string;
  const currentUser = userDataQuery.data?.user;
  const currentUserSentFriendRequests = userDataQuery.data?.sentFriendRequests;
  const currentUserReceivedFriendRequests =
    userDataQuery.data?.receivedFriendRequests;
  const isOwnProfile = currentUser?.username === username || username === "me";
  const profileDataQuery = useUserDataQuery(username);
  const profileData = profileDataQuery.data;
  const { activityEntries, activities } = profileData || {
    activityEntries: [],
    activities: [],
  };
  const api = useApiWithAuth();
  const [showEditActivityEntry, setShowEditActivityEntry] = useState<
    string | null
  >(null);
  const posthog = usePostHog();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeRange, setTimeRange] = useState<"Current Year" | "Current Month">(
    "Current Month"
  );
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [showServerMessage, setShowServerMessage] = useState(false);
  const router = useRouter();

  const isOnesOwnProfile =
    currentUser?.username === username || username === "me";

  useEffect(() => {
    if (username === "me" && userDataQuery.data?.user?.username) {
      window.history.replaceState(
        null, 
        '', 
        `/profile/${userDataQuery.data.user.username}`
      );
    }
  }, [username, userDataQuery.data?.user?.username]);

  useEffect(() => {
    if (!profileData) {
      isOwnProfile ? userDataQuery.refetch() : profileDataQuery.refetch();
    }
  }, [username, userDataQuery, isOwnProfile, profileDataQuery]);

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
        userDataQuery.refetch();
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
          userDataQuery.refetch();
        }
      } catch (error) {
        console.error(`Error ${action}ing friend request:`, error);
        toast.error(`Failed to ${action} friend request`);
      }
    }
  };

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  const getActivitiesNotInPlans = () => {
    const planActivityIds = new Set(
      profileData?.plans?.flatMap((plan) =>
        plan.sessions.map((session) => session.activity_id)
      ) || []
    );

    // Filter activities that are not in plans AND have at least one activity entry
    return activities.filter(
      (activity) =>
        !planActivityIds.has(activity.id) &&
        activityEntries.some((entry) => entry.activity_id === activity.id)
    );
  };

  const handleTimeRangeChange = (value: "Current Year" | "Current Month") => {
    setTimeRange(value);
    setEndDate(
      value === "Current Month" ? endOfMonth(new Date()) : endOfYear(new Date())
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (userDataQuery.isLoading || profileDataQuery.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your profile...</p>
          {showServerMessage && (
            <span className="text-gray-500 text-sm text-left">
              we run on cheap servers...
              <br />
              first request after some inactivity period always takes longer.
              <br />
              <Link
                target="_blank"
                href="https://ko-fi.com/alexramalho"
                className="underline"
              >
                donate?
              </Link>
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!profileData) {
    return <div>No profile data available.</div>;
  }

  const user = profileData.user;

  const getUsername = (user: User | null) => {
    return user?.username === userDataQuery.data?.user?.username
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
                onClick={() => setShowLogoutConfirm(true)}
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
          <TabsList className="grid w-full grid-cols-2 h-13">
            <TabsTrigger value="plans">
              <div className="flex flex-col items-center">
                <ChartArea size={22} />
                <span>Plans</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="history">
              <div className="flex flex-col items-center">
                <History size={22} />
                <span>History</span>
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plans">
            <div className="space-y-4">
              {profileData.plans?.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-lg bg-white">
                  <div className="flex flex-row items-center gap-2 mb-4">
                    <span className="text-4xl">{plan.emoji}</span>
                    <h3 className="text-lg font-semibold">{plan.goal}</h3>
                  </div>
                  <PlanActivityEntriesRenderer
                    plan={convertApiPlanToPlan(plan, activities)}
                    activities={activities}
                    activityEntries={activityEntries}
                  />
                </div>
              ))}
              {(!profileData.plans || profileData.plans.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  You haven&apos;t created any plans yet.
                </div>
              )}
              {getActivitiesNotInPlans().length > 0 && (
                <>
                  <div className="flex flex-row gap-4 justify-between items-center">
                    <Divider className="w-full " text="Other Activities 👇" />

                <div className="flex self-center">
                  <select
                    className="p-2 border rounded-md"
                    value={timeRange}
                    onChange={(e) =>
                      handleTimeRangeChange(
                        e.target.value as "Current Year" | "Current Month"
                      )
                    }
                  >
                    <option value="Current Year">Current Year</option>
                    <option value="Current Month">Current Month</option>
                  </select>
                </div>
              </div>
              <ActivityGridRenderer
                activities={getActivitiesNotInPlans()}
                activityEntries={activityEntries}
                timeRange={timeRange}
                    endDate={endDate}
                  />
                </>
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
                        activityEntryId={entry.id}
                        activityTitle={activity?.title || "Unknown Activity"}
                        activityEmoji={activity?.emoji || ""}
                        activityEntryQuantity={entry.quantity}
                        activityEntryReactions={entry.reactions}
                        activityMeasure={activity?.measure || ""}
                        isoDate={entry.date}
                        daysUntilExpiration={
                          entry.image?.expires_at
                            ? differenceInDays(
                                parseISO(entry.image.expires_at!),
                                new Date()
                              )
                            : -1
                        }
                        hasImageExpired={
                          !entry.image?.expires_at ||
                          new Date(entry.image.expires_at!) < new Date()
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
                  ? "You haven't completed any activities yet."
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
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default ProfilePage;
