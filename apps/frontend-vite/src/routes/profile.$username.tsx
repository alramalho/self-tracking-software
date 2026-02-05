import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import AchievementPostCard from "@/components/AchievementPostCard";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import { useActivities } from "@/contexts/activities/useActivities";
import { BadgeCard } from "@/components/BadgeCard";
import BadgeExplainerPopover from "@/components/BadgeExplainerPopover";
import { BecomeCoachBanner } from "@/components/BecomeCoachBanner";
import { CoachProfileViewDrawer } from "@/components/CoachProfileViewDrawer";
import { SendMessagePopover } from "@/components/SendMessagePopover";
import Divider from "@/components/Divider";
import { FireAnimation, RocketAnimation, SeedAnimation } from "@/components/FireBadge";
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
import { useThemeColors } from "@/hooks/useThemeColors";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useUnifiedProfileData } from "@/hooks/useUnifiedProfileData";
import { useCurrentUser } from "@/contexts/users";
import { ShineBorder } from "@/components/ui/shine-border";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ActivityEntry } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { subDays } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  EllipsisVertical,
  Flame,
  History,
  Loader2,
  MessageCircle,
  Pencil,
  Rocket,
  Sparkles,
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
  const [showCoachProfileDrawer, setShowCoachProfileDrawer] = useState(false);
  const navigate = useNavigate();
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
  const { isAdmin } = useCurrentUser();
  const { deleteAchievementPost } = useActivities();
  const { totalStreaks, totalHabits, totalLifestyles } = useMemo(() => {
    return userifyPlansProgress(
      profileData?.plans?.map((plan) => plan.progress) || []
    );
  }, [profileData?.plans]);

  // Extract activities and activityEntries from profileData for consistency
  const activities = profileData?.activities || [];
  const activityEntries = profileData?.activityEntries || [];
  const achievementPosts = profileData?.achievementPosts || [];
  
  const historyItems = useMemo(() => {
    const items = [
      ...activityEntries.map(entry => ({ type: 'activity' as const, date: new Date(entry.datetime), data: entry })),
      ...achievementPosts.map(post => ({ type: 'achievement' as const, date: new Date(post.createdAt), data: post }))
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activityEntries, achievementPosts]);

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
    (p) => !isPlanExpired({ finishingDate: p.finishingDate }) && !(p as any).archivedAt
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
  const [showMessagePopover, setShowMessagePopover] = useState(false);

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
  const themeColors = useThemeColors();

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
        <div className="flex flex-col items-center pb-6 pt-1 relative">
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

        {/* Instagram-style header: Avatar left, Stats right */}
        <AnimatedSection delay={0.1}>
          <div className="px-4">
            <div className="flex items-center gap-6">
              {/* Left: Avatar with progress ring */}
              <div className="relative flex-shrink-0">
                <ProgressRing
                  size={96}
                  strokeWidth={4}
                  atLeastBronze={accountLevel.atLeastBronze}
                  percentage={accountLevel.percentage}
                  currentLevel={accountLevel.currentLevel}
                  onClick={() => setProgressExplainerOpen(true)}
                >
                  <Avatar className="w-20 h-20">
                    <AvatarImage
                      src={profileData?.picture || ""}
                      alt={profileData?.name || ""}
                    />
                    <AvatarFallback className="text-xl">
                      {(profileData?.name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                </ProgressRing>
                {/* Coach verified badge */}
                {profileData?.coachProfile && (
                  <button
                    onClick={() => setShowCoachProfileDrawer(true)}
                    className="absolute -bottom-0.5 -right-0.5 rounded-full p-1 border-2 border-background shadow-md transition-opacity hover:opacity-80"
                    style={{ backgroundColor: themeColors.hex }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </button>
                )}
              </div>

              {/* Right: Stats grid */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Link
                  to={`/friends/$username`}
                  params={{ username: profileData?.username || "" }}
                >
                  <div className="text-center cursor-pointer">
                    <p className="text-lg font-bold text-foreground">
                      {friends?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Friends</p>
                  </div>
                </Link>

                <div
                  className="text-center cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setProgressExplainerOpen(true)}
                >
                  <p className="text-lg font-bold text-foreground">
                    {accountLevel.totalPoints}
                  </p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>

                {accountLevel.currentLevel && (
                  <div
                    className="flex flex-col items-center justify-center cursor-pointer"
                    onClick={() => setProgressExplainerOpen(true)}
                  >
                    {accountLevel.currentLevel.getIcon({
                      size: 24,
                      className: "drop-shadow-sm",
                    })}
                    <span
                      className="text-xs font-semibold"
                      style={{ color: accountLevel.currentLevel?.color }}
                    >
                      {accountLevel.currentLevel?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Name, username and badges row */}
            <div className="my-3 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {profileData?.name}
                </h2>
                <p className="text-muted-foreground text-sm">
                  @{profileData?.username}
                </p>
              </div>

              {/* Achievement Badges */}
              <div className="flex gap-1.5">
                <BadgeCard
                  count={totalStreaks}
                  width={50}
                  height={62}
                  onClick={() =>
                    setBadgeExplainer({
                      open: true,
                      planIds: planIds,
                      badgeType: "streaks",
                    })
                  }
                >
                  {isProfileDataLoading ? (
                    <Loader2 className="w-full h-full animate-spin mt-3 ml-3" />
                  ) : (
                    <>
                      {totalStreaks == 0 ? (
                        <Flame size={55} className="pb-1 text-red-500 mt-3" />
                      ) : (
                        <FireAnimation
                          height={65}
                          width={65}
                          className="pb-1 w-full h-full"
                        />
                      )}
                    </>
                  )}
                </BadgeCard>
                <BadgeCard
                  count={totalHabits}
                  width={50}
                  height={62}
                  onClick={() =>
                    setBadgeExplainer({
                      open: true,
                      planIds: planIds,
                      badgeType: "habits",
                    })
                  }
                >
                  {isProfileDataLoading ? (
                    <Loader2 className="w-full h-full animate-spin mt-3 ml-3" />
                  ) : (
                    <>
                      {totalHabits == 0 ? (
                        <Sprout size={55} className="pb-1 text-lime-500 mt-3" />
                      ) : (
                        <SeedAnimation
                          height={65}
                          width={65}
                          className="pb-1 w-full h-full"
                        />
                      )}
                    </>
                  )}
                </BadgeCard>
                <BadgeCard
                  count={totalLifestyles}
                  width={50}
                  height={62}
                  onClick={() =>
                    setBadgeExplainer({
                      open: true,
                      planIds: planIds,
                      badgeType: "lifestyles",
                    })
                  }
                >
                  {isProfileDataLoading ? (
                    <Loader2 className="w-full h-full animate-spin mt-3 ml-3" />
                  ) : (
                    <>
                      {totalLifestyles == 0 ? (
                        <Rocket size={55} className="pb-1 text-orange-500 mt-3" />
                      ) : (
                        <RocketAnimation
                          height={65}
                          width={65}
                          className="pb-1 w-full h-full"
                        />
                      )}
                    </>
                  )}
                </BadgeCard>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Coach Card - Runna style */}
        {profileData?.coachProfile && (
          <AnimatedSection delay={0.15}>
            <div className="px-4 mt-4">
              <div
                onClick={() => setShowCoachProfileDrawer(true)}
                className="w-full text-left rounded-2xl overflow-hidden relative group cursor-pointer"
              >
                {/* Background with profile image */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${profileData?.picture || ""})`,
                  }}
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/60" />

                {/* Content */}
                <div className="relative p-4 text-white">
                  {/* Specs Grid - Runna style */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {(profileData.coachProfile.details as any)?.title && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/60">
                          Title
                        </p>
                        <p className="text-sm font-semibold">
                          {(profileData.coachProfile.details as any).title}
                        </p>
                      </div>
                    )}
                    {(profileData.coachProfile.details as any)?.focusDescription && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/60">
                          Focus
                        </p>
                        <p className="text-sm font-semibold">
                          {(profileData.coachProfile.details as any).focusDescription}
                        </p>
                      </div>
                    )}
                    {(profileData.coachProfile.details as any)?.idealPlans?.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/60">
                          Helps with
                        </p>
                        <p className="text-sm font-semibold">
                          {(profileData.coachProfile.details as any).idealPlans
                            .slice(0, 3)
                            .map((p: { emoji: string; title: string }) => `${p.emoji} ${p.title}`)
                            .join(" · ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bio preview */}
                  {(profileData.coachProfile.details as any)?.bio && (
                    <p className="text-xs text-white/70 mt-3 line-clamp-2">
                      {(profileData.coachProfile.details as any).bio}
                    </p>
                  )}

                  {/* Get coached CTA - only show on other profiles */}
                  {!isOwnProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({
                          to: "/get-coached",
                          search: { coach: profileData.username || "" },
                        });
                      }}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white text-sm font-medium transition-colors"
                    >
                      Get coached
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={0.25}>
          <div className="flex flex-col items-start p-3">
            {/* Action buttons */}
            {!isOwnProfile && (
              <div className="flex space-x-3">
                {/* Message button - always show for non-own profiles */}
                <Button
                  size="sm"
                  variant="outline"
                  className="px-6 rounded-full"
                  onClick={() => setShowMessagePopover(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Message
                </Button>

                {/* Friend request buttons */}
                {!isFriend && (
                  <>
                    {hasPendingReceivedConnectionRequest ? (
                      <>
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
                      </>
                    ) : (
                      <Button
                        className="px-8 rounded-full bg-black text-white hover:bg-foreground/90"
                        size="sm"
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
            )}

            {/* Become a coach banner - only for own profile without coach profile */}
            {isOwnProfile && !profileData?.coachProfile && (
              <div className="w-full mt-3">
                <BecomeCoachBanner username={profileData?.username} />
              </div>
            )}

            {/* Year Wrapped Card - only for admins */}
            {isOwnProfile && isAdmin && (
              <Link to="/wrapped" className="block w-full mt-3">
                <div className="relative rounded-2xl overflow-hidden">
                  <ShineBorder
                    shineColor={["#f97316", "#ec4899", "#8b5cf6", "#06b6d4"]}
                    borderWidth={2}
                    duration={4}
                    className="rounded-2xl"
                  />
                  <div className="relative bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <span
                        className="text-xl tracking-wide"
                        style={{
                          fontFamily: 'var(--font-zalando-expanded-black)',
                          fontStyle: 'italic'
                        }}
                      >
                        Your 2025 wrapped
                      </span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </AnimatedSection>

        {/* Content */}
        <AnimatedSection delay={0.3}>
          <div className="px-4">
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
                          entry.activityId && activitiesNotInPlans
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
                {historyItems.length > 0 ? (
                  <div className="space-y-4">
                    {historyItems.map((item) => {
                      if (item.type === 'activity') {
                        const entry = item.data;
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
                      } else {
                        const post = item.data;
                        return (
                          <AchievementPostCard
                            key={post.id}
                            achievementPost={post as any}
                            editable={isOwnProfile}
                            onAvatarClick={() => {
                              // navigate to user profile if needed, but we are already there mostly
                            }}
                            onDeleteClick={() => {
                              deleteAchievementPost({
                                achievementPostId: post.id,
                                userUsername: profileData?.username || "",
                              });
                            }}
                          />
                        );
                      }
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    {isOwnProfile
                      ? "You haven't posted any activity or achievement yet."
                      : `${profileData?.name} hasn't posted anything yet.`}
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
              datetime: showEditActivityEntry.datetime,
              activityId: showEditActivityEntry.activityId || "",
              description: showEditActivityEntry.description || undefined,
              imageUrl: showEditActivityEntry.imageUrl,
              createdAt: showEditActivityEntry.createdAt,
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
        username={profileData?.username || undefined}
      />

      {/* Send Message Popover */}
      {profileData && (
        <SendMessagePopover
          open={showMessagePopover}
          onClose={() => setShowMessagePopover(false)}
          user={{
            id: profileData.id,
            name: profileData.name,
            username: profileData.username,
            picture: profileData.picture,
          }}
        />
      )}

      {/* Coach Profile Drawer */}
      {profileData?.coachProfile && (
        <CoachProfileViewDrawer
          coachProfile={profileData.coachProfile as any}
          ownerName={profileData.name}
          ownerUsername={profileData.username}
          ownerPicture={profileData.picture}
          isOpen={showCoachProfileDrawer}
          onClose={() => setShowCoachProfileDrawer(false)}
          isOwnProfile={isOwnProfile}
          onEditClick={() => {
            navigate({ to: "/create-coach-profile" });
          }}
        />
      )}

    </motion.div>
  );
}
