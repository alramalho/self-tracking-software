"use client";

import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import Divider from "@/components/Divider";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import { PlanBadge } from "@/components/PlanBadge";
import { isPlanExpired } from "@/components/PlansRenderer";
import StreakDetailsPopover from "@/components/profile/PlanProgresPopover";
import ProfileSettingsPopover, {
  ActiveView,
} from "@/components/profile/ProfileSettingsPopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlansProgress } from "@/contexts/PlansProgressContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useUnifiedProfileData } from "@/hooks/useUnifiedProfileData";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { ActivityEntry } from "@tsw/prisma";
import { differenceInDays, subDays } from "date-fns";
import {
  Bell,
  ChartArea,
  Check,
  ChevronLeft,
  History,
  Medal,
  Settings,
  Sprout,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { twMerge } from "tailwind-merge";

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
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const { 
    profileData, 
    isLoading: isProfileDataLoading, 
    isOwnProfile,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    currentUser
  } = useUnifiedProfileData(username);
  
  // Extract activities and activityEntries from profileData for consistency
  const activities = profileData?.activities || [];
  const activityEntries = profileData?.activityEntries || [];

  // For connection requests, we always use the current user data regardless of profile being viewed
  const currentUserSentConnectionRequests = currentUser?.connectionsFrom?.filter(conn => conn.status === 'PENDING') || [];
  const currentUserReceivedConnectionRequests = currentUser?.connectionsTo?.filter(conn => conn.status === 'PENDING') || [];

  const profileActivePlans = profileData?.plans?.filter((p) => !isPlanExpired({finishingDate: p.finishingDate}));
  const [showEditActivityEntry, setShowActivityToEdit] = useState<
    ActivityEntry | undefined
  >(undefined);
  const userInformalName = profileData?.name?.includes(" ")
    ? profileData.name.split(" ")[0]
    : profileData?.username;

  const planIds = profileActivePlans?.map(plan => plan.id) || [];
  const { data: plansProgressData } = usePlansProgress(planIds);
  const [timeRange, setTimeRange] = useState<TimeRange>("60 Days");
  const [endDate, setEndDate] = useState(new Date());
  const { shareOrCopyLink, isShareSupported } = useShareOrCopy();
  const profilePaidPlanType = profileData?.planType;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const redirectTo = searchParams.get("redirectTo");
  const [showStreakDetails, setShowStreakDetails] = useState(
    redirectTo === "streak-details"
  );

  useEffect(() => {
    if (profileData?.username && !username && isOwnProfile) {
      window.history.replaceState(null, "", `/profile/${profileData.username}`);
    }
  }, [profileData?.username, username, isOwnProfile]);

  useEffect(() => {
    const activeView = searchParams.get("activeView");
    if (activeView && isOwnProfile) {
      setShowUserProfile(true);
      setInitialActiveView(activeView);
    }
  }, [searchParams, isOwnProfile]);

  // No longer needed - useQuery handles data fetching automatically

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
      sendFriendRequest(profileData.id);
    }
  };

  const activitiesNotInPlans = useMemo(() => {
    const plansActivityIds = new Set(
      profileActivePlans?.flatMap((plan) => plan.activities?.map((a) => a.id)) ||
        []
    );

    const activitiesNotInPlans = profileData?.activities?.filter(
      (activity) =>
        !plansActivityIds.has(activity.id) &&
        profileData?.activityEntries?.some((entry) => entry.activityId === activity.id)
    );

    return activitiesNotInPlans;
  }, [profileActivePlans, profileData?.activities, profileData?.activityEntries]);

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
    // This only makes sense when looking at external profiles
    // When viewing own profile, we can't be friends with ourselves
    if (isOwnProfile) return false;
    
    return currentUser?.friends?.some(
      (friend) => friend.id === profileData?.id
    );
  };

  if (isProfileDataLoading) {
    return (
      <div className="flex flex-col items-center min-h-screen p-2">
        <div className="w-full max-w-3xl">
          <div className="flex justify-around gap-3 items-center mb-3 ring-2 ring-gray-200 p-3 rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 p-2">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="flex flex-col items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <Skeleton className="h-8 w-8 mx-auto mb-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 h-13 bg-gray-100 rounded-lg p-1 mb-4">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
        <UserX className="w-12 h-12 text-gray-400 mb-2" />
        <div className="text-gray-600">No profile data available. Does this user exist?</div>
        <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-2">
      <div className="w-full max-w-3xl">
        <div
          className={`flex justify-around gap-3 items-center mb-3 ring-2 ring-gray-200 p-3 rounded-2xl bg-white/60 backdrop-blur-sm`}
        >
          {!isOwnProfile && (
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
            {!isOwnProfile && !isFriend() && (
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
                        onClick={() => acceptFriendRequest(profileData.id)}
                      >
                        <Check className="h-6 w-6" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-red-600 bg-red-50"
                        onClick={() => rejectFriendRequest(profileData.id)}
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

              {isOwnProfile && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="border-none"
                    onClick={() =>
                      shareOrCopyLink(
                        `https://app.tracking.so/join/${profileData?.username}`
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

            {/* Achievement badges */}
            {profileActivePlans && profileActivePlans.length > 0 && (
              <div className="flex justify-start gap-2 mb-4">
                {profileActivePlans.map((plan) => {
                  const backendProgress = plansProgressData?.find(p => p.planId === plan.id);
                  const habitAchieved = backendProgress?.habitAchievement?.isAchieved ?? false;
                  const lifestyleAchieved = backendProgress?.lifestyleAchievement?.isAchieved ?? false;
                  
                  // Only render if we have at least one achievement
                  if (!habitAchieved && !lifestyleAchieved) return null;
                  
                  return (
                    <div key={plan.id} className="flex gap-2">
                      {habitAchieved && (
                        <div className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
                          "ring-2 ring-lime-400 bg-gradient-to-r from-lime-50 to-green-50",
                          "shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        )}>
                          <Sprout size={14} className="text-lime-600" />
                          <span className="text-lime-700">Habit</span>
                          <span className="opacity-60">{plan.emoji}</span>
                        </div>
                      )}
                      {lifestyleAchieved && (
                        <div className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
                          "ring-2 ring-orange-400 bg-gradient-to-r from-orange-50 to-amber-50",
                          "shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        )}>
                          <Medal size={14} className="text-orange-600" />
                          <span className="text-orange-700">Lifestyle</span>
                          <span className="opacity-60">{plan.emoji}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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

        {isOwnProfile && (
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
                  const backendProgress = plansProgressData?.find(p => p.planId === plan.id);
                  
                  // Check achievements
                  const habitAchieved = backendProgress?.habitAchievement?.isAchieved ?? false;
                  const lifestyleAchieved = backendProgress?.lifestyleAchievement?.isAchieved ?? false;
                  
                  // Determine neon color based on highest achievement
                  let neonClass = "bg-white ring-gray-200";
                  if (lifestyleAchieved) {
                    // Lifestyle achieved - orange neon
                    neonClass = cn(
                      "ring-offset-2 ring-offset-white",
                      "ring-orange-400 ring-2",
                      "bg-gradient-to-br from-orange-50/80 via-orange-100/60 to-amber-50/80",
                      "shadow-lg shadow-orange-200/50"
                    );
                  } else if (habitAchieved) {
                    // Habit achieved - lime neon
                    neonClass = cn(
                      "ring-offset-2 ring-offset-white",
                      "ring-lime-400 ring-2",
                      "bg-gradient-to-br from-lime-50/80 via-lime-100/60 to-green-50/80",
                      "shadow-lg shadow-lime-200/50"
                    );
                  }
                  
                  return (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-2xl ${neonClass} relative`}
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

                      {/* Achievement displays */}
                      <div className="space-y-2 mb-4 absolute top-2 right-2 flex flex-col gap-2">
                        {habitAchieved && (
                          <div className="flex flex-row items-center gap-2">
                            <Sprout size={42} className="text-lime-500 animate-pulse" />
                            {/* <span className="text-sm text-gray-600">
                              It&apos;s a habit for {userInformalName}
                            </span> */}
                          </div>
                        )}
                        {lifestyleAchieved && (
                          <div className="flex flex-row items-center gap-2">
                            <Medal size={42} className="text-orange-500 animate-pulse" />
                            {/* <span className="text-sm text-gray-600">
                              Part of {userInformalName}&apos;s lifestyle for{" "}
                              {backendProgress?.achievement?.streak ?? 0} weeks
                            </span> */}
                          </div>
                        )}
                      </div>
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
                  {isOwnProfile
                    ? "You haven't created any plans yet."
                    : `${profileData?.name} hasn't got any public plans available.`}
                </div>
              )}
              {activitiesNotInPlans && activitiesNotInPlans.length > 0 && (
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
                        activityEntryReactions={(entry as any).reactions?.reduce((acc: Record<string, string[]>, reaction: any) => {
                          if (!acc[reaction.emoji] && reaction.user.username) {
                            acc[reaction.emoji] = [reaction.user.username];
                          } else if (reaction.user.username) {
                            acc[reaction.emoji].push(reaction.user.username);
                          }
                          return acc;
                        }, {} as Record<string, string[]>) || {}}
                        activityEntryTimezone={entry.timezone || undefined}
                        activityEntryComments={(entry as any).comments || []}
                        activityMeasure={activity?.measure || ""}
                        date={entry.date}
                        description={entry.description || undefined}
                        daysUntilExpiration={
                          entry.imageExpiresAt
                            ? differenceInDays(
                                entry.imageExpiresAt,
                                new Date()
                              )
                            : -1
                        }
                        hasImageExpired={
                          !entry.imageExpiresAt ||
                          new Date(entry.imageExpiresAt) < new Date()
                        }
                        userPicture={profileData?.picture || undefined}
                        userName={profileData?.name || undefined}
                        userUsername={profileData?.username || undefined}
                        editable={isOwnProfile}
                        onEditClick={() => {
                          const activityToEdit = activityEntries.find((e) => e.id === entry.id);
                          if (activityToEdit) {
                            setShowActivityToEdit(activityToEdit);
                          } else {
                            console.error(`Activity ${showEditActivityEntry} to edit not found in activityEntries: ${activityEntries}`);
                            toast.error("Activity to edit not found! Please contact support");
                          }
                        }}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {activityEntries?.length === 0
                  ? isOwnProfile
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
      {showEditActivityEntry && isOwnProfile && (
        <ActivityEntryEditor
          open={!!showEditActivityEntry}
          activityEntry={{
            id: showEditActivityEntry.id,
            quantity: showEditActivityEntry.quantity,
            date: showEditActivityEntry.date,
            activityId: showEditActivityEntry.activityId,
            description: showEditActivityEntry.description || undefined,
          }}
          onClose={() => setShowActivityToEdit(undefined)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
