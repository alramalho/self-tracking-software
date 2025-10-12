import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import { BadgeCard } from "@/components/BadgeCard";
import BadgeExplainerPopover from "@/components/BadgeExplainerPopover";
import Divider from "@/components/Divider";
import { FireAnimation } from "@/components/FireBadge";
import MedalExplainerPopover from "@/components/MedalExplainerPopover";
import NeonCard from "@/components/NeonGradientCard";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import ProfileSettingsPopover, {
  type ActiveView,
} from "@/components/profile/ProfileSettingsPopover";
import { ProgressRing } from "@/components/ProgressRing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useUnifiedProfileData } from "@/hooks/useUnifiedProfileData";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ActivityEntry } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { subDays } from "date-fns";
import {
  ChartArea,
  Check,
  ChevronLeft,
  EllipsisVertical,
  Flame,
  History,
  Loader2,
  Medal,
  Rocket,
  Sprout,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";


export const Route = createFileRoute("/profile/$username")({
  component: ProfilePage,
});

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

// Helper to check if plan is expired
export const isPlanExpired = (plan: {
  finishingDate: Date | null;
}): boolean => {
  if (!plan.finishingDate) return false;
  return plan.finishingDate < new Date();
};

function userifyPlansProgress(plansProgress: PlanProgressData[]): {
  totalStreaks: number;
  totalHabits: number;
  totalLifestyles: number;
} {
  return {
    totalStreaks: plansProgress.reduce((acc, planProgress) => {
      return acc + (planProgress.achievement?.streak || 0);
    }, 0),
    totalHabits: plansProgress.reduce(
      (acc, planProgress) =>
        acc + (planProgress.habitAchievement?.isAchieved ? 1 : 0),
      0
    ),
    totalLifestyles: plansProgress.reduce(
      (acc, planProgress) =>
        acc + (planProgress.lifestyleAchievement?.isAchieved ? 1 : 0),
      0
    ),
  };
}

function ProfilePage() {
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [initialActiveView, setInitialActiveView] = useState<string | null>(
    null
  );
  const { username } = Route.useParams();
  const searchParams = Route.useSearch() as {
    redirectTo?: string;
    activeView?: string;
  };
  const {
    profileData,
    isLoading: isProfileDataLoading,
    isOwnProfile,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    currentUser,
  } = useUnifiedProfileData(username);
  const { totalStreaks, totalHabits, totalLifestyles } = useMemo(() => {
    return userifyPlansProgress(
      profileData?.plans?.map((plan) => plan.progress) || []
    );
  }, [profileData?.plans]);

  // Extract activities and activityEntries from profileData for consistency
  const activities = profileData?.activities || [];
  const activityEntries = profileData?.activityEntries || [];

  // For connection requests, we always use the current user data regardless of profile being viewed
  const currentUserSentConnectionRequests = useMemo(
    () =>
      currentUser?.connectionsFrom?.filter(
        (conn) => conn.status === "PENDING"
      ) || [],
    [currentUser?.connectionsFrom]
  );
  const currentUserReceivedConnectionRequests = useMemo(
    () =>
      currentUser?.connectionsTo?.filter((conn) => conn.status === "PENDING") ||
      [],
    [currentUser?.connectionsTo]
  );

  const profileActivePlans = profileData?.plans?.filter(
    (p) => !isPlanExpired({ finishingDate: p.finishingDate })
  );
  const [showEditActivityEntry, setShowActivityToEdit] = useState<
    ActivityEntry | undefined
  >(undefined);
  const userInformalName = profileData?.name?.includes(" ")
    ? profileData.name.split(" ")[0]
    : profileData?.username;

  const planIds = profileActivePlans?.map((plan) => plan.id) || [];
  const [timeRange, setTimeRange] = useState<TimeRange>("60 Days");
  const [endDate, setEndDate] = useState(new Date());
  const { shareOrCopyLink, isShareSupported } = useShareOrCopy();
  const profilePaidPlanType = profileData?.planType;
  const redirectTo = searchParams?.redirectTo;
  const [progressExplainerOpen, setProgressExplainerOpen] = useState(false);
  const [badgeExplainer, setBadgeExplainer] = useState<{
    open: boolean;
    planIds: string[];
    badgeType: "streaks" | "habits" | "lifestyles" | null;
  }>({ open: false, planIds: [], badgeType: null });

  useEffect(() => {
    if (profileData?.username && !username && isOwnProfile) {
      window.history.replaceState(null, "", `/profile/${profileData.username}`);
    }
  }, [profileData?.username, username, isOwnProfile]);

  useEffect(() => {
    const activeView = searchParams?.activeView;
    if (activeView && isOwnProfile) {
      setShowUserProfile(true);
      setInitialActiveView(activeView);
    }
  }, [searchParams, isOwnProfile]);

  const handleSendConnectionRequest = async () => {
    if (profileData) {
      sendFriendRequest(profileData.id);
    }
  };

  const activitiesNotInPlans = useMemo(() => {
    const plansActivityIds = new Set(
      profileActivePlans?.flatMap((plan) =>
        plan.activities?.map((a) => a.id)
      ) || []
    );

    const activitiesNotInPlans = profileData?.activities?.filter(
      (activity) =>
        !plansActivityIds.has(activity.id) &&
        profileData?.activityEntries?.some(
          (entry) => entry.activityId === activity.id
        )
    );

    return activitiesNotInPlans;
  }, [
    profileActivePlans,
    profileData?.activities,
    profileData?.activityEntries,
  ]);

  const handleTimeRangeChange = (value: TimeRange) => {
    setTimeRange(value);
    setEndDate(new Date());
  };

  const hasPendingReceivedConnectionRequest = useMemo(() => {
    return currentUserReceivedConnectionRequests?.some((request) => {
      return request.fromId === profileData?.id;
    });
  }, [currentUserReceivedConnectionRequests, profileData?.id]);

  const hasPendingSentConnectionRequest = useMemo(() => {
    return currentUserSentConnectionRequests?.some((request) => {
      return request.toId === profileData?.id;
    });
  }, [currentUserSentConnectionRequests, profileData?.id]);

  const friends = useMemo(
    () => [
      ...(profileData?.connectionsFrom
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.to) || []),
      ...(profileData?.connectionsTo
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.from) || []),
    ],
    [profileData?.connectionsFrom, profileData?.connectionsTo]
  );
  const isFriend = useMemo(() => {
    if (isOwnProfile) return false;

    return friends?.some((friend) => friend.id === currentUser?.id);
  }, [friends, currentUser?.id, isOwnProfile]);

  // Calculate total activities logged (hardcoded if you don't know where they come from)
  const totalActivitiesLogged = activityEntries?.length || 0; // Fallback to hardcoded value

  const accountLevel = useAccountLevel(totalActivitiesLogged);

  if (isProfileDataLoading) {
    return (
      <div className="flex flex-col items-center min-h-screen p-2 bg-gradient-to-b from-gray-50 to-white">
        <div className="w-full max-w-md">
          {/* TikTok-style header skeleton */}
          <div className="flex flex-col items-center pt-6">
            <div className="flex justify-between items-center w-full mb-6">
              <div className="w-8"></div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-12 rounded-full" />
            </div>

            {/* Avatar */}
            <Skeleton className="w-24 h-24 rounded-full mb-4" />

            {/* Name and username */}
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-24 mb-6" />

            {/* Stats */}
            <div className="flex justify-center space-x-8 mb-6">
              <div className="text-center">
                <Skeleton className="h-6 w-8 mb-1" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="text-center">
                <Skeleton className="h-6 w-8 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>

            {/* Action button */}
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>

          {/* Tabs skeleton */}
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
        <div className="text-gray-600">
          No profile data available. Does this user exist?
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen">
      <div className="w-full max-w-md">
        {/* TikTok-style Header */}
        <div className="flex flex-col items-center py-6">
          {/* Top bar */}
          <div className="flex justify-between items-center w-full mb-2">
            {!isOwnProfile ? (
              <button
                className="p-2 rounded-full hover:bg-gray-100"
                onClick={() => window.history.back()}
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-8"></div>
            )}

            {isOwnProfile && (
              <button
                className="p-2 pr-4 rounded-full hover:bg-gray-100"
                onClick={() => setShowUserProfile(true)}
              >
                <EllipsisVertical size={26} />
              </button>
            )}
          </div>

          {/* Avatar with progress ring */}
          <div className="relative mb-4">
            <ProgressRing
              size={112}
              strokeWidth={5}
              atLeastBronze={accountLevel.atLeastBronze}
              percentage={accountLevel.percentage}
              currentLevel={accountLevel.currentLevel}
              onClick={() => setProgressExplainerOpen(true)}
            >
              <Avatar className="w-24 h-24">
                <AvatarImage
                  src={profileData?.picture || ""}
                  alt={profileData?.name || ""}
                />
                <AvatarFallback className="text-2xl">
                  {(profileData?.name || "U")[0]}
                </AvatarFallback>
              </Avatar>
            </ProgressRing>
          </div>

          {/* Name and username */}
          <h2 className="text-xl font-bold text-gray-900">
            {profileData?.name}
          </h2>
          <p className="text-gray-600 text-sm mb-3">@{profileData?.username}</p>

          {/* TikTok-style stats */}
          <div className="flex justify-center space-x-8 mb-6">
            <Link
              to={`/friends/$username`}
              params={{ username: profileData?.username || "" }}
            >
              <div className="text-center cursor-pointer">
                <p className="text-xl font-bold text-gray-900">
                  {friends?.length || 0}
                </p>
                <p className="text-sm text-gray-600">Friends</p>
              </div>
            </Link>

            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {totalActivitiesLogged}
              </p>
              <p className="text-sm text-gray-600">Entries</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex justify-center mb-6 gap-3">
            <BadgeCard
              count={totalStreaks}
              width={70}
              height={90}
              onClick={() =>
                setBadgeExplainer({
                  open: true,
                  planIds: planIds,
                  badgeType: "streaks",
                })
              }
            >
              {isProfileDataLoading ? (
                <Loader2 className="w-full h-full animate-spin mt-5 ml-5" />
              ) : (
                <>
                  {totalStreaks == 0 ? (
                    <Flame size={90} className="pb-2 text-red-500 mt-5" />
                  ) : (
                    <FireAnimation
                      height={100}
                      width={100}
                      className="pb-2 w-full h-full"
                    />
                  )}
                </>
              )}
            </BadgeCard>
            <BadgeCard
              count={totalHabits}
              width={70}
              height={90}
              onClick={() =>
                setBadgeExplainer({
                  open: true,
                  planIds: planIds,
                  badgeType: "habits",
                })
              }
            >
              {isProfileDataLoading ? (
                <Loader2 className="w-full h-full animate-spin mt-5 ml-5" />
              ) : (
                <Sprout size={90} className="pb-2 text-lime-500 mt-5" />
              )}
            </BadgeCard>
            <BadgeCard
              count={totalLifestyles}
              width={70}
              height={90}
              onClick={() =>
                setBadgeExplainer({
                  open: true,
                  planIds: planIds,
                  badgeType: "lifestyles",
                })
              }
            >
              {isProfileDataLoading ? (
                <Loader2 className="w-full h-full animate-spin mt-5 ml-5" />
              ) : (
                <Rocket size={90} className="pb-2 text-orange-500 mt-5" />
              )}
            </BadgeCard>
          </div>

          {/* Action buttons */}
          {!isOwnProfile && !isFriend && (
            <>
              {hasPendingReceivedConnectionRequest ? (
                <div className="flex space-x-3 mb-6">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-full"
                    onClick={() =>
                      acceptFriendRequest({
                        id: profileData.id,
                        username: profileData.username || "",
                      })
                    }
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-6 rounded-full"
                    onClick={() =>
                      rejectFriendRequest({
                        id: profileData.id,
                        username: profileData.username || "",
                      })
                    }
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              ) : (
                <Button
                  className="mb-6 px-8 rounded-full bg-black text-white hover:bg-gray-800"
                  onClick={handleSendConnectionRequest}
                  disabled={hasPendingSentConnectionRequest}
                >
                  {hasPendingSentConnectionRequest ? (
                    <>
                      <Check size={16} className="mr-2" />
                      Request Sent
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} className="mr-2" />
                      Add Friend
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Profile Settings Popover */}
          {isOwnProfile && (
            <ProfileSettingsPopover
              open={showUserProfile}
              onClose={() => setShowUserProfile(false)}
              initialActiveView={initialActiveView as ActiveView | null}
              redirectTo={redirectTo}
            />
          )}

          {/* Tabs */}
          <Tabs defaultValue="plans" className="w-full mb-2">
            <TabsList className="grid w-full h-13 grid-cols-2">
              <TabsTrigger value="plans">
                <div className="flex flex-row gap-2 py-[2px] items-center">
                  <ChartArea size={20} />
                  <span>Plans</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="history">
                <div className="flex flex-row gap-2 py-[2px] items-center">
                  <History size={20} />
                  <span>History</span>
                </div>
              </TabsTrigger>
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
                            e.target.value as
                              | "60 Days"
                              | "120 Days"
                              | "180 Days"
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
                    // Check achievements from inline progress data
                    const habitAchieved =
                      plan.progress?.habitAchievement?.isAchieved ?? false;
                    const lifestyleAchieved =
                      plan.progress?.lifestyleAchievement?.isAchieved ?? false;

                    return (
                      <NeonCard
                        key={plan.id}
                        color={
                          lifestyleAchieved
                            ? "amber"
                            : habitAchieved
                            ? "lime"
                            : "none"
                        }
                        className="p-4"
                      >
                        <div className="flex flex-row items-center gap-2 mb-6">
                          <span className="text-4xl">{plan.emoji}</span>
                          <div className="flex flex-col gap-0">
                            <h3 className="text-lg font-semibold">
                              {plan.goal}
                            </h3>
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
                        <div
                          className="space-y-2 mb-4 absolute top-2 right-2 flex flex-col gap-2"
                          onClick={() =>
                            setBadgeExplainer({
                              open: true,
                              planIds: [plan.id],
                              badgeType: lifestyleAchieved
                                ? "lifestyles"
                                : habitAchieved
                                ? "habits"
                                : null,
                            })
                          }
                        >
                          {habitAchieved && (
                            <div className="flex flex-row items-center gap-2">
                              <Sprout
                                size={42}
                                className="text-lime-500 animate-pulse"
                              />
                            </div>
                          )}
                          {lifestyleAchieved && (
                            <div className="flex flex-row items-center gap-2">
                              <Medal
                                size={42}
                                className="text-amber-500 animate-pulse"
                              />
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
                      </NeonCard>
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
                          activity={activity as any}
                          activityEntry={entry as any}
                          user={profileData as any}
                          editable={isOwnProfile}
                          onEditClick={() => {
                            const activityToEdit = activityEntries.find(
                              (e) => e.id === entry.id
                            );
                            if (activityToEdit) {
                              setShowActivityToEdit(activityToEdit);
                            } else {
                              console.error(
                                `Activity ${showEditActivityEntry} to edit not found in activityEntries: ${activityEntries}`
                              );
                              toast.error(
                                "Activity to edit not found! Please contact support"
                              );
                            }
                          }}
                          userPlansProgressData={profileData.plans.map(
                            (plan) => plan.progress
                          )}
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
          </Tabs>
        </div>

        {/* Activity Entry Editor */}
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

      {/* Badge Explainer Popover */}
      <BadgeExplainerPopover
        open={badgeExplainer.open}
        onClose={() => setBadgeExplainer((prev) => ({ ...prev, open: false }))}
        planIds={badgeExplainer.planIds}
        badgeType={badgeExplainer.badgeType}
        user={profileData as any}
        userPlansProgressData={
          profileData?.plans?.map((plan) => plan.progress) || []
        }
      />

      {isOwnProfile && (
        <MedalExplainerPopover
          open={progressExplainerOpen}
          onClose={() => setProgressExplainerOpen(false)}
        />
      )}
    </div>
  );
}
