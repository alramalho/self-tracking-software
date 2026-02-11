"use client";

import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import { AchievementCelebrationPopover, type AchievementType } from "@/components/AchievementCelebrationPopover";
import { AchievementShareDialog } from "@/components/AchievementShareDialog";
import { AnnouncementPopover } from "@/components/AnnouncementPopover";
import { useAchievements } from "@/contexts/achievements";
import AppleLikePopover from "@/components/AppleLikePopover";
import ClientOverviewPopover from "@/components/ClientOverviewPopover";
import FeedbackPopover from "@/components/FeedbackPopover";
import { FeedbackAnnouncementPopover } from "@/components/FeedbackAnnouncementPopover";
import { MetricsLogPopover } from "@/components/MetricsLogPopover";
import Notifications from "@/components/Notifications";
import { PendingPlanBanner } from "@/components/PendingPlanBanner";
import { PlansProgressDisplay } from "@/components/PlansProgressDisplay";
import TimelineRenderer from "@/components/TimelineRenderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  MoveRight,
  Heart,
  Pause,
  RefreshCcw,
  Search,
  Send,
  Target,
  Users,
} from "lucide-react";
import { useState, useRef, useMemo, useEffect } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { motion, AnimatePresence } from "framer-motion";
import supportAgentWhiteSvg from "../assets/icons/support-agent-white.svg";
import supportAgentSvg from "../assets/icons/support-agent.svg";
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
import { useMessages } from "@/contexts/messages";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { isAfter, isFuture, isToday } from "date-fns";
import { useAI } from "@/contexts/ai";
import { type MetricEntry } from "@tsw/prisma";
import { PulsatingCirclePill } from "@/components/ui/pulsating-circle-pill";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";

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

// Type for client plan data from /coaches/my-clients
interface ClientPlan {
  id: string;
  goal: string;
  emoji: string | null;
  user: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

function HomePage() {
  const { currentUser, hasLoadedUserData, isAdmin } = useCurrentUser();
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { isLightMode, isDarkMode } = useTheme();
  const { activityEntryId } = Route.useSearch();
  const { notifications } = useDataNotifications();
  const { totalUnreadCount } = useMessages();
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
  const [isClientsCollapsed, setIsClientsCollapsed] = useLocalStorage<boolean>(
    "clients-section-collapsed",
    false
  );
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const [showAICoachPopover, setShowAICoachPopover] = useState(false);
  const { isLoaded, isSignedIn } = useSession();
  const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);
  const [hasFinishedLastCoachMessageAnimation, setHasFinishedLastCoachMessageAnimation] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientPlan | null>(null);

  // Fetch coach's clients if user has a coach profile
  const { data: coachClients } = useQuery({
    queryKey: ["coach-clients"],
    queryFn: async () => {
      const response = await api.get<ClientPlan[]>("/coaches/my-clients");
      return response.data;
    },
    enabled: !!currentUser?.coachProfile,
  });

  useEffect(() => {
    console.log({VITE_SUPABASE_API_URL: import.meta.env.VITE_SUPABASE_API_URL})
  }, []);

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

  // Achievement celebration from context
  const {
    celebrationToShow,
    handleCelebrationClose,
    markAchievementAsCelebrated,
    dismissCelebration,
    isMarkingAsCelebrated,
  } = useAchievements();

  // Local state to preserve celebration data during close animation
  const [celebrationData, setCelebrationData] = useState(celebrationToShow);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(!!celebrationToShow);

  // Sync celebration data from context, but preserve during close animation
  useEffect(() => {
    if (celebrationToShow) {
      setCelebrationData(celebrationToShow);
      setIsCelebrationOpen(true);
    } else {
      // Close animation first, then clear data
      setIsCelebrationOpen(false);
      const timer = setTimeout(() => setCelebrationData(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [celebrationToShow]);

  // Achievement share state (local UI concern)
  const [shareDialogData, setShareDialogData] = useState<{
    planId?: string;
    planEmoji: string;
    planGoal: string;
    achievementType: AchievementType;
    streakNumber?: number;
    levelName?: string;
    levelThreshold?: number;
  } | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const handleCelebrationShare = () => {
    if (!celebrationData) return;
    // Transfer celebration data to share dialog
    setShareDialogData(celebrationData);
    setIsShareDialogOpen(true);
    dismissCelebration();
  };

  const handleShareDialogClose = async () => {
    if (!shareDialogData) return;
    await markAchievementAsCelebrated({
      planId: shareDialogData.planId,
      achievementType: shareDialogData.achievementType,
      levelThreshold: shareDialogData.levelThreshold,
    });
    // Close animation first, then clear data
    setIsShareDialogOpen(false);
    setTimeout(() => setShareDialogData(null), 300);
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
  const shouldShowPlusUpgradeWelcomeAnnouncement = !isUserOnFreePlan && metricEntries && metricEntries.length === 0 && currentUser !== undefined && currentUser.planType === "PLUS";
  
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
                <span
                  className={cn(
                    "text-3xl font-cursive text-foreground/60",
                    isUserOnFreePlan && "cursor-pointer"
                  )}
                  onClick={isUserOnFreePlan ? () => setShowUpgradePopover(true) : undefined}
                >
                  {isUserOnFreePlan ? "Free" : "Plus"}
                </span>
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
                  onClick={() => navigate({ to: "/search" })}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors duration-200"
                  title="Search"
                >
                  <Search size={24} />
                </button>
                <div className="relative">
                  <button
                    onClick={() => navigate({ to: "/messages" })}
                    className="p-2 hover:bg-muted/50 rounded-full transition-colors duration-200"
                    title="Messages"
                  >
                    <Send
                      size={28}
                      className="text-foreground"
                    />
                    <AnimatePresence>
                      {totalUnreadCount > 0 && (
                        <motion.span
                          key="message-badge"
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center z-1000"
                        >
                          {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.05}>
            <PendingPlanBanner />
          </AnimatedSection>

          {/* My Clients Section - Only shown for coaches */}
          {currentUser?.coachProfile && coachClients && coachClients.length > 0 && (
            <AnimatedSection delay={0.075}>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsClientsCollapsed((prev) => !prev)}
                      className="p-1 hover:bg-muted/50 rounded transition-colors duration-200 flex items-center justify-center"
                      aria-label={
                        isClientsCollapsed
                          ? "Expand clients"
                          : "Collapse clients"
                      }
                    >
                      {isClientsCollapsed ? (
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
                    <Users size={18} className="text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                      My Clients
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      ({coachClients.length})
                    </span>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {!isClientsCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2">
                        {coachClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className="w-full p-3 flex items-center gap-3 bg-card hover:bg-muted/50 rounded-3xl border border-border transition-colors text-left"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarImage
                                src={client.user.picture || undefined}
                                alt={client.user.name || client.user.username}
                              />
                              <AvatarFallback>
                                {(client.user.name || client.user.username)[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {client.user.name || client.user.username}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {client.emoji || "📋"} {client.goal}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </AnimatedSection>
          )}

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
                    <Target size={18} className="text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                      Your Plans
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      ({activePlans.length})
                    </span>
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
      {celebrationData && (
        <AchievementCelebrationPopover
          open={isCelebrationOpen}
          onClose={handleCelebrationClose}
          onShare={handleCelebrationShare}
          achievementType={celebrationData.achievementType}
          planEmoji={celebrationData.planEmoji}
          planGoal={celebrationData.planGoal}
          streakNumber={celebrationData.streakNumber}
          levelName={celebrationData.levelName}
          isLoading={isMarkingAsCelebrated}
        />
      )}

      {/* Achievement Share Dialog */}
      {shareDialogData && (
        <AchievementShareDialog
          open={isShareDialogOpen}
          onClose={handleShareDialogClose}
          planId={shareDialogData.planId}
          planEmoji={shareDialogData.planEmoji}
          planGoal={shareDialogData.planGoal}
          achievementType={shareDialogData.achievementType}
          streakNumber={shareDialogData.streakNumber}
          levelName={shareDialogData.levelName}
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

      <AnnouncementPopover
        id="pause-plan-feature-2025"
        title="Pause Your Plans!"
        icon={<Pause size={32} className="text-foreground" />}
        description={
          <span>
            Need a break? You can now pause your plans when life gets in the way.
            <span className="block mt-2 text-yellow-600 dark:text-yellow-400 font-medium">
              Note: Streaks will still count down while paused.
            </span>
          </span>
        }
        actionLabel="Try it out →"
        onAction={() => navigate({ to: "/plans" })}
      />

      {shouldShowPlusUpgradeWelcomeAnnouncement && (
        <AnnouncementPopover
          id="plus-upgrade-welcome-2026"
          title={`Thank you ${currentUser.name || currentUser.username || "User"} for being a Plus User`}
          icon={<Heart size={32} className="text-foreground" />}
          description="You help keeping tracking.so alive"
          imageSrcs={["https://tracking.so/metrics_rose_dark.png"]}
          actionLabel="Explore Metrics →"
          onAction={() => navigate({ to: "/insights/onboarding" })}
        />
      )}

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

      {/* Client Overview Popover for Coaches */}
      {selectedClient && (
        <ClientOverviewPopover
          open={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          planId={selectedClient.id}
          clientInfo={selectedClient.user}
          planGoal={selectedClient.goal}
          planEmoji={selectedClient.emoji}
        />
      )}

      <FloatingCoachWidget />
    </div>
  );
}

