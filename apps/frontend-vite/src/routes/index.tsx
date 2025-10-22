"use client";

import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import { AnnouncementPopover } from "@/components/AnnouncementPopover";
import AppleLikePopover from "@/components/AppleLikePopover";
import FeedbackPopover from "@/components/FeedbackPopover";
import { FloatingCoachWidget } from "@/components/FloatingCoachWidget";
import { HomepageMetricsSection } from "@/components/HomepageMetricsSection";
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
import { useState, useRef } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";
import { motion } from "framer-motion";
import supportAgentWhiteSvg from "../assets/icons/support-agent-white.svg";
import supportAgentSvg from "../assets/icons/support-agent.svg";
import jarvisLogoSvg from "../assets/icons/jarvis_logo_transparent.png";
import jarvisLogoWhiteSvg from "../assets/icons/jarvis_logo_white_transparent.png";

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
import { isAfter, isFuture } from "date-fns";
import { useAI } from "@/contexts/ai";

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
  const { plans } = usePlans();
  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const { metrics } = useMetrics();
  const { refetchAllData } = useGlobalDataOperations();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
  const { activityEntries } = useActivities();
  const totalActivitiesLogged = activityEntries?.length || 0;
  const accountLevel = useAccountLevel(totalActivitiesLogged);

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
  };

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
                    <button
                      onClick={() => navigate({ to: "/ai" })}
                      className="p-0 hover:bg-muted/50 rounded-full transition-colors duration-200"
                      title="Send Feedback"
                    >
                      <img
                        src={isLightMode ? jarvisLogoSvg : jarvisLogoWhiteSvg}
                        alt="AI Coach"
                        className="w-9 h-9"
                      />
                    </button>
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
          <HomepageMetricsSection />
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

      <AnnouncementPopover
        id="new-plans-2025-october"
        title="New plans page!"
        icon={<BarChart3 size={32} className="text-foreground" />}
        description="We've revamped the plans page to make it easier to manage your plans and see insightful data."
        imageSrcs={["/images/screenshots/new-plans.png", "/images/screenshots/new-plans-2.png", "/images/screenshots/new-plans-3.png"]}
        actionLabel="Try it out →"
        onAction={() => navigate({ to: "/plans" })}
      />

      {/* Floating Coach Widget */}
      <FloatingCoachWidget />
    </div>
  );
}

export default HomePage;
