import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import { BadgeCard } from "@/components/BadgeCard";
import BadgeExplainerPopover from "@/components/BadgeExplainerPopover";
import Divider from "@/components/Divider";
import { FireAnimation } from "@/components/FireBadge";
import MedalExplainerPopover from "@/components/MedalExplainerPopover";
import ProfileSettingsPopover, {
  type ActiveView,
} from "@/components/profile/ProfileSettingsPopover";
import { ProfilePlanCard } from "@/components/profile/ProfilePlanCard";
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
  BarChart3,
  Check,
  ChevronLeft,
  EllipsisVertical,
  Flame,
  History,
  Loader2,
  Rocket,
  Sprout,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { motion, useInView } from "framer-motion";

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
  return new Date(plan.finishingDate) < new Date();
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

// Animated section component that fades in when scrolled into view
const AnimatedSection = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

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

  const planIds = profileActivePlans?.map((plan) => plan.id) || [];
  const [endDate, setEndDate] = useState(new Date());
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

  // Calculate account level (handles all data internally)
  const accountLevel = useAccountLevel(username);

  if (isProfileDataLoading) {
    return (
      <div className="flex flex-col items-center min-h-screen p-2 bg-gradient-to-b from-muted to-background">
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
          <div className="grid grid-cols-2 gap-4 h-13 bg-muted rounded-lg p-1 mb-4">
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
        <UserX className="w-12 h-12 text-muted-foreground mb-2" />
        <div className="text-muted-foreground">
          No profile data available. Does this user exist?
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full max-w-md">
        {/* TikTok-style Header */}
        <AnimatedSection>
          <div className="flex flex-col items-center py-6 relative">
            {/* Settings button - absolutely positioned */}
            {isOwnProfile && (
              <button
                className="absolute top-2 right-2 p-2 pr-4 rounded-full hover:bg-muted/50 z-10"
                onClick={() => setShowUserProfile(true)}
              >
                <EllipsisVertical size={26} />
              </button>
            )}

            {/* Back button for non-own profiles */}
            {!isOwnProfile && (
              <div className="absolute top-2 left-2 z-10">
                <button
                  className="p-2 rounded-full hover:bg-muted/50"
                  onClick={() => window.history.back()}
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="flex flex-col items-center">
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
            <h2 className="text-xl font-bold text-foreground">
              {profileData?.name}
            </h2>
            <p className="text-muted-foreground text-sm mb-3">
              @{profileData?.username}
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.15}>
          <div className="flex flex-col items-center">
            {/* TikTok-style stats */}
            <div className="flex items-center justify-center space-x-8 mb-6">
              <Link
                to={`/friends/$username`}
                params={{ username: profileData?.username || "" }}
              >
                <div className="text-center cursor-pointer">
                  <p className="text-xl font-bold text-foreground">
                    {friends?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Friends</p>
                </div>
              </Link>

              <div
                className="text-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setProgressExplainerOpen(true)}
              >
                <div className="flex items-center justify-center gap-1">
                  <p className="text-xl font-bold text-foreground">
                    {profileData?.activityEntries?.length || 0}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Entries</p>
              </div>

              {accountLevel.currentLevel && (
                <>
                  <div className="flex flex-col items-center justify-center gap-1" onClick={() => setProgressExplainerOpen(true)}>
                    {accountLevel.currentLevel.getIcon({
                      size: 35,
                      className: "drop-shadow-sm",
                    })}
                    <span
                      className="text-sm px-1.5 py-0.5 rounded-full bg-transparentfont-semibold"
                      style={{ color: accountLevel.currentLevel?.color }}
                    >
                      {accountLevel.currentLevel?.name}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="flex flex-col items-center">
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
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.25}>
          <div className="flex flex-col items-center">
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
                    className="mb-6 px-8 rounded-full bg-black text-white hover:bg-foreground/90"
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
        </AnimatedSection>

        {/* Content */}
        <AnimatedSection delay={0.3}>
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
                    <BarChart3 size={20} />
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
                  {profileActivePlans &&
                    profileActivePlans.length > 0 &&
                    [...profileActivePlans]
                      .sort((a, b) => {
                        // Coached plans always come first
                        if (a.isCoached && !b.isCoached) return -1;
                        if (!a.isCoached && b.isCoached) return 1;

                        // If both are coached or both are not coached, sort by creation date
                        return (
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                        );
                      })
                      .map((plan) => (
                        <ProfilePlanCard
                          key={plan.id}
                          plan={plan as any}
                          activities={activities}
                          activityEntries={activityEntries}
                          isOwnProfile={isOwnProfile}
                          onBadgeClick={(badgeType) =>
                            setBadgeExplainer({
                              open: true,
                              planIds: [plan.id],
                              badgeType,
                            })
                          }
                        />
                      ))}
                  {(!profileActivePlans || profileActivePlans.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
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
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
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
                  <div className="text-center text-muted-foreground py-8">
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
        </AnimatedSection>

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

      <MedalExplainerPopover
        open={progressExplainerOpen}
        onClose={() => setProgressExplainerOpen(false)}
        username={profileData?.username}
      />
    </motion.div>
  );
}
