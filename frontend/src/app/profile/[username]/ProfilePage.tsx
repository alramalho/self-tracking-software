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
  Star,
  SquareActivity,
  Paintbrush,
} from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
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
  subDays,
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
import { EmotionViewer } from "@/components/EmotionViewer";
import { DemoEmotionViewer } from "@/components/DemoEmotionViewer";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { ThemeColor, getThemeConfig } from "@/utils/theme";

const ProfilePage: React.FC = () => {
  const { clearNotifications } = useNotifications();
  const { signOut } = useClerk();
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const { useCurrentUserDataQuery, useUserDataQuery, refetchUserData, messagesData, updateTheme, currentTheme } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const params = useParams();
  const username = params.username as string;
  const currentUser = currentUserQuery.data?.user;
  const currentUserSentFriendRequests = currentUserQuery.data?.sentFriendRequests;
  const currentUserReceivedFriendRequests =
    currentUserQuery.data?.receivedFriendRequests;
  const isOwnProfile = currentUser?.id === currentUserQuery.data?.user?.id;
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
  const [timeRange, setTimeRange] = useState<"30 Days" | "180 Days">("30 Days");
  const [endDate, setEndDate] = useState(new Date());
  const [showServerMessage, setShowServerMessage] = useState(false);
  const userHasAccessToAi = posthog.isFeatureEnabled("ai-bot-access");
  const { share, isSupported: isShareSupported } = useShare();
  const [copied, copyToClipboard] = useClipboard();
  const isOnesOwnProfile =
    currentUser?.id === profileData?.user?.id;
  const [showColorPalette, setShowColorPalette] = useState(false);

  const colorPalettes = [
    {
      name: "Slate",
      color: "slate" as ThemeColor,
    },
    {
      name: "Blue",
      color: "blue" as ThemeColor,
    },
    {
      name: "Violet",
      color: "violet" as ThemeColor,
    },
    {
      name: "Emerald",
      color: "emerald" as ThemeColor,
    },
    {
      name: "Rose",
      color: "rose" as ThemeColor,
    },
    {
      name: "Amber",
      color: "amber" as ThemeColor,
    },
  ];

  useEffect(() => {
    if (currentUser?.username && !username) {
      window.history.replaceState(
        null,
        "",
        `/profile/${currentUser.username}`
      );
    }
  }, [currentUser?.username, username]);

  useEffect(() => {
    if (!profileData) {
      isOwnProfile ? currentUserQuery.refetch() : profileDataQuery.refetch();
    }
  }, [username, currentUserQuery, isOwnProfile, profileDataQuery]);

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
      await toast.promise(
        (async () => {
          await api.post(`/send-friend-request/${profileData!.user!.id}`);
          await currentUserQuery.refetch();
        })(),
        {
          loading: "Sending friend request...",
          success: "Friend request sent successfully",
          error: "Failed to send friend request",
        }
      );
    }
  };

  const handleFriendRequest = async (action: "accept" | "reject") => {
    if (profileData && profileData.user) {
      const request = currentUserReceivedFriendRequests?.find(
        (req) =>
          req.sender_id === profileData.user?.id && req.status === "pending"
      );
      if (request) {
        await toast.promise(
          (async () => {
            await api.post(`${action}-friend-request/${request.id}`);
            await currentUserQuery.refetch();
          })(),
          {
            loading: `${action}ing friend request...`,
            success: `Friend request ${action}ed`,
            error: `Failed to ${action} friend request`,
          }
        );
      }
    }
  };

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  const activitiesNotInPlans = useMemo(() => {
    const planActivityIds = new Set(
      profileData?.plans?.flatMap((plan) => plan.activity_ids) || []
    );

    // Filter activities that are not in plans AND have at least one activity entry
    return activities.filter(
      (activity) =>
        !planActivityIds.has(activity.id) &&
        activityEntries.some((entry) => entry.activity_id === activity.id)
    );
  }, [profileData?.plans, activities, activityEntries]);

  const handleTimeRangeChange = (value: "30 Days" | "180 Days") => {
    setTimeRange(value);
    setEndDate(new Date());
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleThemeChange = async (color: ThemeColor) => {
    try {
      await updateTheme(color);
      toast.success(`Theme updated to ${color}`);
      setShowColorPalette(false);
    } catch (error) {
      console.error('Failed to update theme:', error);
      toast.error('Failed to update theme');
    }
  };

  if (currentUserQuery.isLoading || profileDataQuery.isLoading) {
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
    return user?.username;
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
        <div className="flex justify-around gap-4 items-center mb-4">
          <div className="flex flex-col items-center">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.picture || ""} alt={user?.name || ""} />
              <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Link href={`/friends/${getUsername(user)}`}>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {user?.friend_ids?.length || 0}
                </p>
                <p className="text-sm text-gray-500">Friends</p>
              </div>
            </Link>
            {!isOwnProfile && !isFriend() && (
              <>
                {hasPendingReceivedFriendRequest() ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      has sent you a friend request
                    </p>
                    <div className="flex space-x-6">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-green-600 bg-green-50"
                        onClick={() => handleFriendRequest("accept")}
                      >
                        <Check className="h-6 w-6" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-red-600 bg-red-50"
                        onClick={() => handleFriendRequest("reject")}
                      >
                        <X className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                ) : (
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
                )}
              </>
            )}
          </div>
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
              <Paintbrush
                size={24}
                className="cursor-pointer"
                onClick={() => setShowColorPalette(true)}
              />
            </div>
          )}
        </div>

        {isOwnProfile && (
          <>
            <AppleLikePopover
              open={showUserProfile}
              onClose={() => setShowUserProfile(false)}
            >
              <div className="max-h-[80vh] overflow-y-auto">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full mb-4 flex items-center justify-center gap-2"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </Button>
                <UserProfile routing={"hash"} />
              </div>
            </AppleLikePopover>

            <AppleLikePopover
              open={showColorPalette}
              onClose={() => setShowColorPalette(false)}
            >
              <div className="p-4 space-y-4">
                <h3 className="text-lg font-semibold mb-4">Color Themes</h3>
                <div className="grid gap-4">
                  {colorPalettes.map((palette) => {
                    const themeConfig = getThemeConfig(palette.color);
                    const isSelected = currentTheme === palette.color;
                    return (
                      <div
                        key={palette.name}
                        className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                          isSelected ? `ring-2 ring-offset-2 ring-${palette.color}-500` : ''
                        }`}
                        onClick={() => handleThemeChange(palette.color)}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && <Check className={`w-4 h-4 text-${palette.color}-500`} />}
                          <span className="font-medium">{palette.name}</span>
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <div className={`w-6 h-6 rounded-full ${themeConfig.primary}`}></div>
                          <div className={`w-6 h-6 rounded-full ${themeConfig.secondary}`}></div>
                          <div className={`w-6 h-6 rounded-full ${themeConfig.accent}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AppleLikePopover>

            <Button
              variant="outline"
              className="w-full mb-3 bg-white"
              onClick={async () => {
                try {
                  const link = `https://app.tracking.so/join/${currentUserQuery.data?.user?.username}`;
                  if (isShareSupported) {
                    const success = await share(link);
                    if (!success) throw new Error("Failed to share");
                  } else {
                    const success = await copyToClipboard(link);
                    if (!success) throw new Error("Failed to copy");
                  }
                } catch (error) {
                  console.error("Failed to copy link to clipboard");
                }
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />Invite friends
            </Button>
          </>
        )}

        <Tabs defaultValue="plans" className="w-full">
          <TabsList
            className={`grid w-full h-13 bg-gray-50/50 ${
              isOnesOwnProfile && userHasAccessToAi ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
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
            {userHasAccessToAi && isOnesOwnProfile && (
              <TabsTrigger value="mood">
                <div className="flex flex-col items-center">
                  <SquareActivity size={22} />
                  <span>Mood</span>
                </div>
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="plans">
            <div className="space-y-4">
              <Divider className="w-full " text="Plans 👇" />
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
              {activitiesNotInPlans.length > 0 && (
                <>
                  <div className="flex flex-row gap-4 justify-between items-center">
                    <Divider className="w-full " text="Activities 👇" />
                    <div className="flex self-center">
                      <select
                        className="p-2 border rounded-md"
                        value={timeRange}
                        onChange={(e) =>
                          handleTimeRangeChange(
                            e.target.value as "30 Days" | "180 Days"
                          )
                        }
                      >
                        <option value="30 Days">Last 30 Days</option>
                        <option value="180 Days">Last 180 Days</option>
                      </select>
                    </div>
                  </div>
                  <ActivityGridRenderer
                    activities={activitiesNotInPlans}
                    activityEntries={activityEntries.filter((entry) =>
                      activitiesNotInPlans
                        .map((a) => a.id)
                        .includes(entry.activity_id)
                    )}
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
                        activityEntryReactions={entry.reactions || {}}
                        activityMeasure={activity?.measure || ""}
                        isoDate={entry.date}
                        description={entry.description}
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
          {userHasAccessToAi && isOnesOwnProfile && (
            <TabsContent value="mood">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-white">
                  <div className="flex flex-row items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">
                      Emotional Profile ⭐️
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground">
                      <Link
                        href="https://github.com/alramalho/self-tracking-software"
                        className="underline"
                      >
                        We don&apos;t store your voice data
                      </Link>
                    </p>
                  </div>
                  <EmotionViewer messages={messagesData.data?.messages || []} />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      {showEditActivityEntry && isOnesOwnProfile && (
        <ActivityEntryEditor
          open={!!showEditActivityEntry}
          activityEntry={
            activityEntries.find((entry) => entry.id === showEditActivityEntry)!
          }
          onDelete={() => {
            profileDataQuery.refetch();
          }}
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
