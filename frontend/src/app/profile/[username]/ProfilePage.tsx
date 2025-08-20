"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Bell,
  ChartArea,
  Check,
  History,
  Settings,
  UserPlus,
  X,
  ChevronLeft,
  Medal,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { parseISO, differenceInDays, subDays } from "date-fns";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import Link from "next/link";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import Divider from "@/components/Divider";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import { twMerge } from "tailwind-merge";
import { PlanBadge } from "@/components/PlanBadge";
import ProfileSettingsPopover, {
  ActiveView,
} from "@/components/profile/ProfileSettingsPopover";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import GenericLoader from "@/components/GenericLoader";
import { isPlanExpired } from "@/components/PlansRenderer";
import StreakDetailsPopover from "@/components/profile/PlanProgresPopover";
import { usePlanProgress } from "@/contexts/PlanProgressContext";
import { cn } from "@/lib/utils";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";

type TimeRange = "60 Days" | "120 Days" | "180 Days";

// Utility function to convert TimeRange to number of days
export const getTimeRangeDays = (timeRange: TimeRange): number => {
  switch (timeRange) {
    case "60 Days":
      return 60;
    case "120 Days":
      return 120;
    case "180 Days":
      return 180;
    default:
      return 60;
  }
};

const ProfilePage: React.FC = () => {
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [initialActiveView, setInitialActiveView] = useState<string | null>(
    null
  );
  const { useCurrentUserDataQuery, useUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const currentUser = currentUserQuery.data;
  const currentUserSentConnectionRequests = currentUser?.connectionsFrom?.filter(conn => conn.status === 'PENDING');
  const currentUserReceivedConnectionRequests = currentUser?.connectionsTo?.filter(conn => conn.status === 'PENDING');
  const profileDataQuery = useUserDataQuery(username);
  const { isSuccess: isProfileDataSuccesfullyLoaded, data: profileData } =
    profileDataQuery;
  const { activityEntries, activities, plans } = profileData || {
    activityEntries: [],
    activities: [],
  };
  const profileActivePlans = plans?.filter((p) => !isPlanExpired(p));
  const api = useApiWithAuth();
  const [showEditActivityEntry, setShowEditActivityEntry] = useState<
    string | null
  >(null);
  const userInformalName = profileData?.name?.includes(" ")
    ? profileData.name.split(" ")[0]
    : profileData?.username;

  const { plansProgress } = usePlanProgress();
  const [timeRange, setTimeRange] = useState<TimeRange>("60 Days");
  const [endDate, setEndDate] = useState(new Date());
  const { shareOrCopyLink, isShareSupported } = useShareOrCopy();
  const isOnesOwnProfile = currentUser?.id === profileData?.id;
  const profilePaidPlanType = profileData?.planType;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const redirectTo = searchParams.get("redirectTo");
  const [showStreakDetails, setShowStreakDetails] = useState(
    redirectTo === "streak-details"
  );

  useEffect(() => {
    if (currentUser?.username && !username) {
      window.history.replaceState(null, "", `/profile/${currentUser.username}`);
    }
  }, [currentUser?.username, username]);

  useEffect(() => {
    if (!profileData) {
      isOnesOwnProfile
        ? currentUserQuery.refetch()
        : profileDataQuery.refetch();
    }
  }, [username, currentUserQuery, isOnesOwnProfile, profileDataQuery]);

  useEffect(() => {
    const activeView = searchParams.get("activeView");
    if (activeView && isOnesOwnProfile) {
      setShowUserProfile(true);
      setInitialActiveView(activeView);
    }
  }, [searchParams, isOnesOwnProfile]);

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

  const handleSendConnectionRequest = async () => {
    if (profileData) {
      await toast.promise(
        (async () => {
          await api.post(`/users/send-connection-request/${profileData!.id}`);
          await currentUserQuery.refetch();
        })(),
        {
          loading: "Sending connection request...",
          success: "Connection request sent successfully",
          error: "Failed to send connection request",
        }
      );
    }
  };

  const handleConnectionRequest = async (action: "accept" | "reject") => {
    if (profileData) {
      const request = currentUserReceivedConnectionRequests?.find(
        (req) => req.fromId === profileData.id
      );
      if (request) {
        await toast.promise(
          (async () => {
            await api.post(`/users/${action}-connection-request/${request.id}`);
            await currentUserQuery.refetch();
          })(),
          {
            loading: `${action}ing connection request...`,
            success: `Connection request ${action}ed`,
            error: `Failed to ${action} connection request`,
          }
        );
      }
    }
  };

  const activitiesNotInPlans = useMemo(() => {
    const plansActivityIds = new Set(
      profileActivePlans?.flatMap((plan) => plan.activities.map((a) => a.id)) ||
        []
    );

    const activitiesNotInPlans = activities.filter(
      (activity) =>
        !plansActivityIds.has(activity.id) &&
        activityEntries.some((entry) => entry.activityId === activity.id)
    );

    return activitiesNotInPlans;
  }, [profileData?.plans, activities, activityEntries]);

  const handleTimeRangeChange = (value: TimeRange) => {
    setTimeRange(value);
    setEndDate(new Date());
    // Force a recalculation by closing and reopening the streak details if it's open
    if (showStreakDetails) {
      setShowStreakDetails(false);
      // Small delay to ensure the popover closes before reopening
      setTimeout(() => setShowStreakDetails(true), 100);
    }
  };

  const hasPendingReceivedConnectionRequest = () => {
    return currentUserReceivedConnectionRequests?.some(
      (request) =>
        request.fromId === profileData?.id
    );
  };

  const hasPendingSentConnectionRequest = () => {
    return currentUserSentConnectionRequests?.some(
      (request) =>
        request.toId === profileData?.id
    );
  };

  const isFriend = () => {
    return currentUser?.friends?.some(
      (friend) => friend.id === profileData?.id
    );
  };

  if (!isProfileDataSuccesfullyLoaded) {
    return (
      <div className="flex flex-col items-center mx-auto my-8">
        <GenericLoader message="Loading profile..." />
      </div>
    );
  }

  if (isProfileDataSuccesfullyLoaded && !profileData) {
    return <div>No profile data available.</div>;
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-2">
      <div className="w-full max-w-3xl">
        <div
          className={`flex justify-around gap-3 items-center mb-3 ring-2 ring-gray-200 p-3 rounded-2xl bg-white/60 backdrop-blur-sm`}
        >
          {!isOnesOwnProfile && (
            <button
              className="absolute -left-1 -top-1 p-2 rounded-full hover:bg-gray-100"
              onClick={() => window.history.back()}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="flex flex-col items-center gap-2 p-2">
            <div className="relative">
              <Avatar
                className={twMerge(
                  "w-20 h-20",
                  profilePaidPlanType !== "FREE" &&
                    "ring-2 ring-offset-2 ring-offset-white",
                  profilePaidPlanType === "PLUS" && variants.ring
                )}
              >
                <AvatarImage
                  src={profileData?.picture || ""}
                  alt={profileData?.name || ""}
                />
                <AvatarFallback>{(profileData?.name || "U")[0]}</AvatarFallback>
              </Avatar>
              {profilePaidPlanType && profilePaidPlanType !== "FREE" && (
                <div className="absolute -bottom-1 -right-1">
                  <PlanBadge planType={profilePaidPlanType} size={28} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-600 mx-auto">
                {profileData?.name}
              </span>
              <span className="text-xs text-gray-400 mx-auto">
                @{profileData?.username}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            {!isOnesOwnProfile && !isFriend() && (
              <>
                {hasPendingReceivedConnectionRequest() ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      has sent you a friend request
                    </p>
                    <div className="flex space-x-6">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-green-600 bg-green-50"
                        onClick={() => handleConnectionRequest("accept")}
                      >
                        <Check className="h-6 w-6" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-red-600 bg-red-50"
                        onClick={() => handleConnectionRequest("reject")}
                      >
                        <X className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={handleSendConnectionRequest}
                    disabled={hasPendingSentConnectionRequest()}
                  >
                    {hasPendingSentConnectionRequest() ? (
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
          <div className="flex flex-col items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link href={`/friends/${profileData?.username}`}>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {profileData?.friends?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">Friends</p>
                </div>
              </Link>

              {isOnesOwnProfile && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="border-none"
                    onClick={() =>
                      shareOrCopyLink(
                        `https://app.tracking.so/join/${currentUserQuery.data?.username}`
                      )
                    }
                  >
                    <UserPlus size={24} />
                  </Button>
                  <div className="flex items-center space-x-1">
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
                </>
              )}
            </div>

            {/* <div className="relative overflow-x-scroll w-full pb-3 h-full">
              <div className="flex justify-start gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                {isOnesOwnProfile && profileData?.plans && (
                  <div className="flex justify-start gap-2">
                    {achivements
                      ?.filter(({ achievement }) => achievement.isAchieved)
                      .map(({ plan }) => {
                        return (
                          <TrophyBadge key={plan.id}>
                            <span className="opacity-100 ml-1">
                              {plan.emoji}
                            </span>
                          </TrophyBadge>
                        );
                      })}
                    {achivements?.map(({ plan, achievement }) => {
                      return (
                        <FireBadge
                          key={plan.id}
                          onClick={() => setShowStreakDetails(true)}
                        >
                          x{achievement.planScore}
                          <span className="opacity-100 ml-1">{plan.emoji}</span>
                        </FireBadge>
                      );
                    })}
                  </div>
                )}

                {isOnesOwnProfile && userPaidPlanType === "PLUS" && (
                  <>
                    <div
                      onClick={() => setShowUpgradePopover(true)}
                      className="relative text-2xl font-bold flex items-center gap-1 ml-2 min-w-fit min-h-fit"
                    >
                      <picture>
                        <source
                          srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.webp"
                          type="image/webp"
                        />
                        <img
                          src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.gif"
                          alt="🌱"
                          width="54"
                          height="54"
                        />
                      </picture>
                      <span className="absolute bottom-0 right-[50%] translate-x-[50%] text-lg font-cursive">
                        supporter
                      </span>
                    </div>
                  </>
                )}
              </div>

              </div> */}
            <StreakDetailsPopover
              open={showStreakDetails}
              onClose={() => {
                setShowStreakDetails(false);
              }}
            />
          </div>
        </div>

        {isOnesOwnProfile && (
          <>
            <ProfileSettingsPopover
              open={showUserProfile}
              onClose={() => setShowUserProfile(false)}
              initialActiveView={initialActiveView as ActiveView | null}
              redirectTo={redirectTo}
            />
          </>
        )}

        <Tabs defaultValue="plans" className="w-full mb-2">
          <TabsList className={`grid w-full h-13 bg-gray-100 grid-cols-2`}>
            <TabsTrigger value="plans">
              <div className="flex flex-row gap-2 py-[2px] items-center">
                <ChartArea size={22} />
                <span>Plans</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="history">
              <div className="flex flex-row gap-2 py-[2px] items-center">
                <History size={22} />
                <span>History</span>
              </div>
            </TabsTrigger>
            {/* {userHasAccessToAi && isOnesOwnProfile && (
              <TabsTrigger value="mood">
                <div className="flex flex-col items-center">
                  <SquareActivity size={22} />
                  <span>Mood</span>
                </div>
              </TabsTrigger>
            )} */}
          </TabsList>
          <TabsContent value="plans">
            <div className="space-y-4 mt-4">
              {profileData?.plans && profileData?.plans.length > 0 && (
                <div className="flex flex-row gap-4 justify-between items-center">
                  <span className="text-sm text-gray-500">Time range</span>
                  <div className="flex self-center">
                    <select
                      className="p-2 border rounded-md font-medium text-gray-800"
                      value={timeRange}
                      onChange={(e) =>
                        handleTimeRangeChange(
                          e.target.value as "60 Days" | "120 Days" | "180 Days"
                        )
                      }
                    >
                      <option value="60 Days">Since 60 days ago</option>
                      <option value="120 Days">Since 120 days ago</option>
                      <option value="180 Days">Since 180 days ago</option>
                    </select>
                  </div>
                </div>
              )}
              {profileActivePlans &&
                profileActivePlans.length > 0 &&
                profileActivePlans.map((plan) => {
                  const planProgress = plansProgress.find(
                    (p) => p.plan.id === plan.id
                  );
                  return (
                    <div
                      key={plan.id}
                      className={`p-4 ring-2 rounded-2xl ${
                        planProgress?.achievement.isAchieved
                          ? cn(
                              "ring-offset-2 ring-offset-white",
                              variants.card.selected.border,
                              variants.ringBright,
                              variants.verySoftGrandientBg
                            )
                          : "bg-white ring-gray-200"
                      }`}
                    >
                      <div className="flex flex-row items-center gap-2 mb-6">
                        <span className="text-4xl">{plan.emoji}</span>
                        <div className="flex flex-col gap-0">
                          <h3 className="text-lg font-semibold">{plan.goal}</h3>
                          {plan.outlineType == "TIMES_PER_WEEK" && (
                            <span className="text-sm text-gray-500">
                              {plan.timesPerWeek} times per week
                            </span>
                          )}
                          {plan.outlineType == "SPECIFIC" && (
                            <span className="text-sm text-gray-500">
                              Custom plan
                            </span>
                          )}
                        </div>
                      </div>

                      {planProgress?.achievement.isAchieved && (
                        <div className="flex flex-row items-center gap-2">
                          <Medal size={32} className="text-yellow-500" />
                          <span className="text-sm text-gray-500">
                            Part of {userInformalName}&apos;s lifestyle for{" "}
                            {planProgress?.achievement.streak} weeks
                          </span>
                        </div>
                      )}
                      <PlanActivityEntriesRenderer
                        plan={plan as any}
                        activities={activities}
                        activityEntries={activityEntries}
                        startDate={subDays(
                          new Date(),
                          getTimeRangeDays(timeRange)
                        )}
                      />
                    </div>
                  );
                })}
              {(!profileActivePlans || profileActivePlans.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  {isOnesOwnProfile
                    ? "You haven't created any plans yet."
                    : `${profileData?.name} hasn't got any public plans available.`}
                </div>
              )}
              {activitiesNotInPlans.length > 0 && (
                <>
                  <Divider className="w-full" text="Activities 👇" />
                  <ActivityGridRenderer
                    activities={activitiesNotInPlans}
                    activityEntries={activityEntries.filter((entry) =>
                      activitiesNotInPlans
                        .map((a) => a.id)
                        .includes(entry.activityId)
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
                      (a) => a.id === entry.activityId
                    );
                    return (
                      <ActivityEntryPhotoCard
                        key={entry.id}
                        imageUrl={entry.imageUrl || undefined}
                        activityEntryId={entry.id}
                        activityTitle={activity?.title || "Unknown Activity"}
                        activityEmoji={activity?.emoji || ""}
                        activityEntryQuantity={entry.quantity}
                        activityEntryReactions={entry.reactions.reduce((acc, reaction) => {
                          if (!acc[reaction.emoji] && reaction.user.username) {
                            acc[reaction.emoji] = [reaction.user.username];
                          } else if (reaction.user.username) {
                            acc[reaction.emoji].push(reaction.user.username);
                          }
                          return acc;
                        }, {} as Record<string, string[]>)}
                        activityEntryTimezone={entry.timezone || undefined}
                        activityEntryComments={entry.comments}
                        activityMeasure={activity?.measure || ""}
                        date={entry.date}
                        description={entry.description || undefined}
                        daysUntilExpiration={
                          entry.imageExpiresAt
                            ? differenceInDays(
                                parseISO(entry.imageExpiresAt.toISOString()!),
                                new Date()
                              )
                            : -1
                        }
                        hasImageExpired={
                          !entry.imageExpiresAt ||
                          new Date(entry.imageExpiresAt!) < new Date()
                        }
                        userPicture={profileData?.picture || undefined}
                        userName={profileData?.name || undefined}
                        userUsername={profileData?.username || undefined}
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
                  ? isOnesOwnProfile
                    ? "You haven't completed any activities yet."
                    : `${profileData?.name} hasn't got any public activities.`
                  : `${profileData?.name}'s ${activities.length} past activities photos have expired.`}
              </div>
            )}
          </TabsContent>
          {/* {userHasAccessToAi && isOnesOwnProfile && (
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
          )} */}
        </Tabs>
      </div>
      {showEditActivityEntry && isOnesOwnProfile && (
        <ActivityEntryEditor
          open={!!showEditActivityEntry}
          activityEntry={{
            id: activityEntries.find((entry) => entry.id === showEditActivityEntry)!.id,
            quantity: activityEntries.find((entry) => entry.id === showEditActivityEntry)!.quantity,
            date: activityEntries.find((entry) => entry.id === showEditActivityEntry)!.date.toISOString(),
            activityId: activityEntries.find((entry) => entry.id === showEditActivityEntry)!.activityId,
            description: activityEntries.find((entry) => entry.id === showEditActivityEntry)!.description || undefined,
          }}
          onDelete={() => {
            profileDataQuery.refetch();
          }}
          onClose={() => setShowEditActivityEntry(null)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
