"use client";

import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import { AchievementCelebrationPopover, type AchievementType } from "@/components/AchievementCelebrationPopover";
import { AnnouncementPopover } from "@/components/AnnouncementPopover";
import AppleLikePopover from "@/components/AppleLikePopover";
import FeedbackPopover from "@/components/FeedbackPopover";
import { FeedbackAnnouncementPopover } from "@/components/FeedbackAnnouncementPopover";
import { LastCoachMessageShower } from "@/components/LastCoachMessageShower";
import { MetricsLogPopover } from "@/components/MetricsLogPopover";
import Notifications from "@/components/Notifications";
import { PlansProgressDisplay } from "@/components/PlansProgressDisplay";
import TimelineRenderer from "@/components/TimelineRenderer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BarChartHorizontal,
  Bell,
  ChevronDown,
  ChevronRight,
  Moon,
  MoveRight,
  RefreshCcw,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { motion, AnimatePresence } from "framer-motion";
import supportAgentWhiteSvg from "../assets/icons/support-agent-white.svg";
import supportAgentSvg from "../assets/icons/support-agent.svg";
import jarvisLogoSvg from "../assets/icons/jarvis_logo_transparent.png";
import jarvisLogoWhiteSvg from "../assets/icons/jarvis_logo_white_transparent.png";
import { FloatingCoachWidget } from "@/components/FloatingCoachWidget";
import { MaintenanceOverlay } from "@/components/MaintenanceOverlay";
import { ProgressRing } from "@/components/ProgressRing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/contexts/activities/useActivities";
import { useSession } from "@/contexts/auth";
import { useGlobalDataOperations } from "@/contexts/GlobalDataProvider";
import { useMetrics } from "@/contexts/metrics";
import { useDataNotifications } from "@/contexts/notifications";
import { usePlans } from "@/contexts/plans";
import { useTheme } from "@/contexts/theme/useTheme";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { isAfter, isFuture, isToday } from "date-fns";
import { useAI } from "@/contexts/ai";
import { type MetricEntry } from "@tsw/prisma";
import { PulsatingCirclePill } from "@/components/ui/pulsating-circle-pill";

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (
    search: Record<string, unknown>
  ): { activityEntryId?: string } => {
    return {
      activityEntryId: (search.activityEntryId as string) || undefined,
    };
  },
});

// Maintenance mode configuration
const MAINTENANCE_MODE_ENABLED =
  import.meta.env.VITE_MAINTENANCE_MODE_ENABLED === "true";
const WHITELISTED_EMAILS: string[] = [];
// Fixed maintenance end date: October 10th, 2025 at midnight UTC
const MAINTENANCE_END_DATE = new Date("2025-10-10T00:00:00Z");

// Animated section component that fades in on mount
const AnimatedSection = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

function HomePage() {
  const { currentUser, hasLoadedUserData } = useCurrentUser();
  const navigate = useNavigate();
  const { isLightMode, isDarkMode } = useTheme();
  const { activityEntryId } = Route.useSearch();
  const { notifications } = useDataNotifications();
  const lastCoachNotification = useMemo(() => {
    return notifications?.filter((n) => n.type === "COACH").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [notifications]);
  const { plans } = usePlans();
  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const { metrics } = useMetrics();
  const { refetchAllData } = useGlobalDataOperations();
  const { activityEntries } = useActivities();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMetricsPopoverOpen, setIsMetricsPopoverOpen] = useState(false);
  const [isPlansCollapsed, setIsPlansCollapsed] = useLocalStorage<boolean>(
    "plans-section-collapsed",
    false
  );
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const [showAICoachPopover, setShowAICoachPopover] = useState(false);
  const { isLoaded, isSignedIn } = useSession();
  const { isUserAIWhitelisted } = useAI();
  const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);
  const [hasFinishedLastCoachMessageAnimation, setHasFinishedLastCoachMessageAnimation] = useState(false);

  // Calculate unlogged metrics count
  const { entries: metricEntries } = useMetrics();
  const unloggedMetricsCount = metrics?.filter((metric) => {
    const todaysEntry = metricEntries?.find(
      (entry: MetricEntry) =>
        entry.metricId === metric.id && isToday(entry.createdAt)
    );
    const isLoggedToday = !!todaysEntry && todaysEntry.rating > 0;
    const isSkippedToday = !!todaysEntry && todaysEntry.skipped;
    return !isLoggedToday && !isSkippedToday;
  }).length || 0;
  const unopenedNotifications =
    notifications?.filter((n) => {
      // Exclude engagement notifications
      if (n.type === "ENGAGEMENT") return false;

      // Actionable notifications (require user action) - count until concluded
      if (n.type === "FRIEND_REQUEST" || n.type === "PLAN_INVITATION") {
        return n.status !== "CONCLUDED";
      }

      // Non-actionable notifications - count until opened
      return n.status !== "OPENED" && n.status !== "CONCLUDED";
    }) || [];

  const unopenedNotificationsCount = unopenedNotifications.length;
  const accountLevel = useAccountLevel();

  // Achievement celebration state
  const [celebrationToShow, setCelebrationToShow] = useState<{
    planId: string;
    planEmoji: string;
    planGoal: string;
    achievementType: AchievementType;
    streakNumber?: number;
  } | null>(null);

  // Detect uncelebrated achievements
  const { upsertPlan } = usePlans();
  useMemo(() => {
    if (!plans) return;

    // Check all active plans for uncelebrated achievements
    for (const plan of plans) {
      if (!plan.progress) continue;

      const progress = plan.progress;

      console.log("progress", progress);

      // Check streak achievement
      if (
        progress.achievement?.achievedLastStreakAt &&
        (!progress.achievement?.celebratedStreakAt ||
          new Date(progress.achievement.achievedLastStreakAt) > new Date(progress.achievement.celebratedStreakAt))
      ) {
        setCelebrationToShow({
          planId: plan.id,
          planEmoji: plan.emoji || "🎯",
          planGoal: plan.goal,
          achievementType: "streak",
          streakNumber: progress.achievement.streak,
        });
        return;
      }

      // Check habit achievement
      if (
        progress.habitAchievement?.achievedAt &&
        (!progress.habitAchievement?.celebratedAt ||
          new Date(progress.habitAchievement.achievedAt) > new Date(progress.habitAchievement.celebratedAt))
      ) {
        setCelebrationToShow({
          planId: plan.id,
          planEmoji: plan.emoji || "🎯",
          planGoal: plan.goal,
          achievementType: "habit",
        });
        return;
      }

      // Check lifestyle achievement
      if (
        progress.lifestyleAchievement?.achievedAt &&
        (!progress.lifestyleAchievement?.celebratedAt ||
          new Date(progress.lifestyleAchievement.achievedAt) > new Date(progress.lifestyleAchievement.celebratedAt))
      ) {
        setCelebrationToShow({
          planId: plan.id,
          planEmoji: plan.emoji || "🎯",
          planGoal: plan.goal,
          achievementType: "lifestyle",
        });
        return;
      }
    }
  }, [plans]);

  const handleCelebrationClose = async () => {
    if (!celebrationToShow) return;

    const plan = plans?.find((p) => p.id === celebrationToShow.planId);
    if (!plan?.progress) return;

    // Update the appropriate celebratedAt field in progressState
    const now = new Date();
    const updatedProgressState = { ...plan.progress };

    if (celebrationToShow.achievementType === "streak") {
      updatedProgressState.achievement = {
        ...updatedProgressState.achievement,
        celebratedStreakAt: now,
      };
    } else if (celebrationToShow.achievementType === "habit") {
      updatedProgressState.habitAchievement = {
        ...updatedProgressState.habitAchievement,
        celebratedAt: now,
      };
    } else if (celebrationToShow.achievementType === "lifestyle") {
      updatedProgressState.lifestyleAchievement = {
        ...updatedProgressState.lifestyleAchievement,
        celebratedAt: now,
      };
    }

    // Update the plan's progressState via the backend
    await upsertPlan({
      planId: celebrationToShow.planId,
      updates: {
        progressState: updatedProgressState as any,
      },
      muteNotifications: true,
    });

    setCelebrationToShow(null);
  };

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
  };

  const handleTestimonialSubmit = async (data: {
    sentiment: number;
    message: string;
    wasRewritten: boolean;
  }) => {
    setIsSubmittingTestimonial(true);
    try {
      const api = (await import("@/lib/api")).default;
      await api.post("/users/submit-testimonial-feedback", data);
    } catch (error) {
      console.error("Failed to submit testimonial feedback:", error);
      throw error;
    } finally {
      setIsSubmittingTestimonial(false);
    }
  };

  // Check if user has more than 50 activities
  const shouldShowTestimonialPopover = activityEntries && activityEntries.length > 50;

  // Show loader for unauthenticated users (prevents flash before redirect)
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
        <div className="bg-muted ring-1 ring-border backdrop-blur-sm rounded-full py-2 px-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex flex-row gap-1 items-center">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-9 h-9 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (
    isLoaded &&
    isSignedIn &&
    (!hasLoadedUserData || !currentUser?.onboardingCompletedAt)
  ) {
    return (
      <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
        {/* Header Skeleton */}
        <div className="bg-muted ring-1 ring-border backdrop-blur-sm rounded-full py-2 px-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex flex-row gap-1 items-center">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-9 h-9 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Plans Section Skeleton */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="w-4 h-4 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Plan Progress Cards Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>

        {/* Timeline Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Check if maintenance mode is enabled and user is not whitelisted
  const isUserWhitelisted =
    currentUser?.email && WHITELISTED_EMAILS.includes(currentUser.email);
  if (
    MAINTENANCE_MODE_ENABLED &&
    !isUserWhitelisted &&
    isFuture(MAINTENANCE_END_DATE)
  ) {
    return <MaintenanceOverlay targetDate={MAINTENANCE_END_DATE} />;
  }

  return (
    <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
      <PullToRefresh
        onRefresh={async () => {
          await refetchAllData();
        }}
        pullingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw size={24} className="text-muted-foreground" />
          </div>
        }
        refreshingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw
              size={24}
              className="text-muted-foreground animate-spin"
            />
          </div>
        }
      >
        <div className="space-y-4 p-[1px]">
          <AnimatedSection delay={0}>
            <div className={`flex justify-between items-center`}>
              <div className="flex flex-row gap-1 items-center text-center">
                <ProgressRing
                  size={50}
                  strokeWidth={4}
                  atLeastBronze={accountLevel.atLeastBronze}
                  percentage={accountLevel.percentage}
                  currentLevel={accountLevel.currentLevel}
                  badge={false}
                  onClick={() =>
                    navigate({
                      to: `/profile/$username`,
                      params: { username: currentUser?.username || "" },
                    })
                  }
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={currentUser?.picture || ""}
                      alt={currentUser?.name || ""}
                    />
                    <AvatarFallback className="text-2xl">
                      {(currentUser?.name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                </ProgressRing>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFeedbackOpen(true)}
                  className="p-0 hover:bg-muted/50 rounded-full transition-colors duration-200"
                  title="Send Feedback"
                >
                  <img
                    src={isLightMode ? supportAgentSvg : supportAgentWhiteSvg}
                    alt="Support"
                    className="w-9 h-9"
                  />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen(true)}
                    className="p-2 hover:bg-muted/50 rounded-full transition-colors duration-200 relative"
                  >
                    <Bell size={24} />
                    {unopenedNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unopenedNotificationsCount > 9
                          ? "9+"
                          : unopenedNotificationsCount}
                      </span>
                    )}
                  </button>
                </div>
                <button
                  onClick={() => navigate({ to: "/insights/dashboard" })}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors duration-200"
                  title="AI Insights"
                >
                  <BarChartHorizontal size={24} />
                </button>
                {isUserAIWhitelisted && (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => navigate({ to: "/ai" })}
                        className="p-0 hover:bg-muted/50 rounded-full transition-colors duration-200"
                        title="AI Coach"
                      >
                        <img
                          src={isLightMode ? jarvisLogoSvg : jarvisLogoWhiteSvg}
                          alt="AI Coach"
                          className="w-9 h-9"
                        />
                        <AnimatePresence>
                          {lastCoachNotification && hasFinishedLastCoachMessageAnimation && lastCoachNotification.status !== "CONCLUDED" && (
                            <motion.span
                              key="coach-badge"
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center z-1000"
                            >
                              1
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </AnimatedSection>

          {activePlans && activePlans.length > 0 && (
            <AnimatedSection delay={0.1}>
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activePlans.length > 1 && (
                      <button
                        onClick={() => setIsPlansCollapsed((prev) => !prev)}
                        className="p-1 hover:bg-muted/50 rounded transition-colors duration-200 flex items-center justify-center"
                        aria-label={
                          isPlansCollapsed
                            ? "Expand streaks"
                            : "Collapse streaks"
                        }
                      >
                        {isPlansCollapsed ? (
                          <ChevronRight
                            size={16}
                            className="text-muted-foreground"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="text-muted-foreground"
                          />
                        )}
                      </button>
                    )}
                    <div className="flex flex-row items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        Your Plans
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate({ to: "/plans" })}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    View Details
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="mt-2">
                  <PlansProgressDisplay isExpanded={!isPlansCollapsed} />
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>
      </PullToRefresh>

      {metrics && metrics.length > 0 && !isUserOnFreePlan && (
        <AnimatedSection delay={0.15}>
          <Button
            onClick={() => setIsMetricsPopoverOpen(true)}
            className="w-full"
            variant="outline"
          >
            Log metrics{unloggedMetricsCount > 0 ? ` (${unloggedMetricsCount} missing today)` : ''} {unloggedMetricsCount > 0 && <PulsatingCirclePill variant="yellow" size="md" className="ml-2" />}
          </Button>
        </AnimatedSection>
      )}

      <AnimatedSection delay={0.2}>
        <div className="mb-6">
          <TimelineRenderer
            onOpenSearch={() => navigate({ to: "/search" })}
            highlightActivityEntryId={activityEntryId}
          />
        </div>
      </AnimatedSection>

      <AppleLikePopover
        onClose={handleNotificationsClose}
        open={isNotificationsOpen}
        title="Notifications"
        displayIcon={false}
      >
        <Notifications onClose={handleNotificationsClose} />
      </AppleLikePopover>

      {/* Metrics Log Popover */}
      <MetricsLogPopover
        open={isMetricsPopoverOpen}
        onClose={() => setIsMetricsPopoverOpen(false)}
      />

      {/* AI Coach Popover */}
      <AppleLikePopover
        onClose={() => setShowAICoachPopover(false)}
        open={showAICoachPopover}
        displayIcon={false}
      >
        <AICoachFeaturePreview>
          <Button
            size="lg"
            className="w-full mt-8 rounded-xl"
            onClick={() => {
              setShowAICoachPopover(false);
              setShowUpgradePopover(true);
            }}
          >
            <span>Start trial</span> <MoveRight className="ml-3 w-4 h-4" />
          </Button>
        </AICoachFeaturePreview>
      </AppleLikePopover>

      {/* Feedback Modal */}
      <FeedbackPopover
        email={currentUser?.email || ""}
        onClose={() => setIsFeedbackOpen(false)}
        isEmailEditable={!currentUser?.email}
        open={isFeedbackOpen}
      />

      {/* Achievement Celebration Popover */}
      {celebrationToShow && (
        <AchievementCelebrationPopover
          open={!!celebrationToShow}
          onClose={handleCelebrationClose}
          achievementType={celebrationToShow.achievementType}
          planEmoji={celebrationToShow.planEmoji}
          planGoal={celebrationToShow.planGoal}
          streakNumber={celebrationToShow.streakNumber}
        />
      )}

      {/* <AnnouncementPopover
        id="night-mode-2025"
        title="Night Mode is Here!"
        icon={<Moon size={32} className="text-foreground" />}
        description="Switch between light and dark themes to match your preference. Perfect for late-night tracking sessions!"
        imageSrc={"/images/screenshots/night-mode.png"}
        actionLabel="Try it out →"
        onAction={() =>
          navigate({
            to: `/profile/$username`,
            params: { username: currentUser?.username || "" },
            search: { activeView: "themeMode" },
          })
        }
      /> */}
{/* 
      <AnnouncementPopover
        id="new-plans-2025-october"
        title="New plans page!"
        icon={<BarChart3 size={32} className="text-foreground" />}
        description="We've revamped the plans page to make it easier to manage your plans and see insightful data."
        imageSrcs={["/images/screenshots/new-plans.png", "/images/screenshots/new-plans-2.png", "/images/screenshots/new-plans-3.png"]}
        actionLabel="Try it out →"
        onAction={() => navigate({ to: "/plans" })}
      /> */}

      {/* Testimonial Feedback Popover */}
      {shouldShowTestimonialPopover && currentUser && (
        <FeedbackAnnouncementPopover
          open={shouldShowTestimonialPopover}
          userName={currentUser.name || currentUser.username || "User"}
          userPicture={currentUser.picture}
          activityEntryCount={activityEntries?.length || 0}
          onSubmit={handleTestimonialSubmit}
        />
      )}

      <FloatingCoachWidget />
    </div>
  );
}
