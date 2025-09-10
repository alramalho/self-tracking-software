"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import FeedbackPopover from "@/components/FeedbackPopover";
import { HomepageMetricsSection } from "@/components/HomepageMetricsSection";
import InsightsDemo from "@/components/InsightsDemo";
import Notifications from "@/components/Notifications";
import { PlansProgressDisplay } from "@/components/PlansProgressDisplay";
import TimelineRenderer from "@/components/TimelineRenderer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  RefreshCcw,
  ScanFace,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";

import PlanProgressPopover from "@/components/profile/PlanProgresPopover";
import { useGlobalDataOperations } from "@/contexts/GlobalDataProvider";
import { useMetrics } from "@/contexts/metrics";
import { useDataNotifications } from "@/contexts/notifications";
import { usePlans } from "@/contexts/plans";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useCurrentUser } from "@/contexts/users";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useSession } from "@clerk/clerk-react";

const HomePage: React.FC = () => {
  const router = useRouter();
  const { notifications, clearAllNotifications } = useDataNotifications();
  const { plans } = usePlans();
  const { metrics } = useMetrics();
  const { refetchAllData } = useGlobalDataOperations();
  const { currentUser, hasLoadedUserData } = useCurrentUser();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isPlansCollapsed, setIsPlansCollapsed] = useLocalStorage<boolean>(
    "plans-section-collapsed",
    false
  );
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const [showPlanProgressExplainer, setShowPlanProgressExplainer] =
    useState(false);
  const [showAICoachPopover, setShowAICoachPopover] = useState(false);
  const { isLoaded, isSignedIn } = useSession();

  const unreadNotifications =
    notifications?.filter(
      (n) => n.status !== "CONCLUDED" && n.type !== "ENGAGEMENT"
    ) || [];

  const unreadNotificationsCount = unreadNotifications.length;

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
  };

  if (isLoaded && isSignedIn && (!hasLoadedUserData || !currentUser?.onboardingCompletedAt)) {
     // todo: this !currentUser?.onboardingCompletedAt should not be necessary, but somehow general initializer letting it go through to get here?

    return (
      <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
        {/* Header Skeleton */}
        <div className="bg-gray-50 ring-1 ring-gray-200 backdrop-blur-sm rounded-full py-2 px-4 shadow-sm">
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

  return (
    <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
      <PullToRefresh
        onRefresh={async () => {
          await refetchAllData();
        }}
        pullingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw size={24} className="text-gray-500" />
          </div>
        }
        refreshingContent={
          <div className="flex items-center justify-center my-4">
            <RefreshCcw size={24} className="text-gray-500 animate-spin" />
          </div>
        }
      >
        <div className="space-y-4 p-[1px]">
          <div
            className={`flex justify-between items-center bg-gray-50 ring-1 ring-gray-200 backdrop-blur-sm rounded-full py-2 px-4 shadow-sm`}
          >
            <div className="flex flex-row gap-1 items-center text-center">
              <img
                src="/icons/icon-transparent.png"
                alt="Jarvis Logo"
                className="w-10 h-10"
              />
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                <span className={`${variants.text} break-normal text-nowrap`}>
                  tracking.<span className={`${variants.fadedText}`}>so</span>
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="p-0 hover:bg-gray-100 rounded-full transition-colors duration-200"
                title="Send Feedback"
              >
                <img
                  src="/icons/support-agent.svg"
                  alt="Support"
                  className="w-9 h-9"
                />
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 relative"
                >
                  <Bell size={24} />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadNotificationsCount > 9
                        ? "9+"
                        : unreadNotificationsCount}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={() => router.push("/insights/dashboard")}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                title="AI Insights"
              >
                <ScanFace size={24} />
              </button>
            </div>
          </div>

          {/* AI Coach Banner */}
          {isUserOnFreePlan && (
            <div
              onClick={() => setShowAICoachPopover(true)}
              className="bg-gradient-to-r from-purple-50 to-blue-50 ring-1 ring-purple-200 backdrop-blur-sm rounded-full py-3 px-4 shadow-sm cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ScanFace size={24} className="text-purple-500" />
                  <div>
                    <span className="text-sm font-semibold text-purple-700">
                      AI Coach & Insights
                    </span>
                    <p className="text-xs text-purple-600">
                      Get personalized coaching and track daily metrics
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-purple-500" />
              </div>
            </div>
          )}

          {plans && plans.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlansCollapsed((prev) => !prev)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                    aria-label={
                      isPlansCollapsed ? "Expand streaks" : "Collapse streaks"
                    }
                  >
                    {isPlansCollapsed ? (
                      <ChevronRight size={16} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-600" />
                    )}
                  </button>
                  <div className="flex flex-row items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Your Plans
                    </h3>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPlanProgressExplainer(true)}
                    >
                      <HelpCircle className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/plans`)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                >
                  View Details
                  <ChevronRight size={16} />
                </button>
              </div>

              <PlansProgressDisplay isExpanded={!isPlansCollapsed} />
            </div>
          )}
        </div>
      </PullToRefresh>

      {metrics && metrics.length > 0 && !isUserOnFreePlan && (
        <HomepageMetricsSection />
      )}

      <div className="mb-6">
        <TimelineRenderer onOpenSearch={() => router.push("/search")} />
      </div>

      <AppleLikePopover
        onClose={handleNotificationsClose}
        open={isNotificationsOpen}
        title="Notifications"
        displayIcon={false}
      >
        <Notifications />
      </AppleLikePopover>

      {/* <DailyCheckinBanner/> */}

      <PlanProgressPopover
        open={showPlanProgressExplainer}
        onClose={() => {
          setShowPlanProgressExplainer(false);
        }}
      />

      {/* AI Coach Popover */}
      <AppleLikePopover
        onClose={() => setShowAICoachPopover(false)}
        open={showAICoachPopover}
        title="AI Coach & Insights"
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <ScanFace size={30} className="text-purple-500" />
            <div>
              <h3 className="text-lg font-semibold">AI Coach & Insights</h3>
              <p className="text-gray-600 text-sm">
                Get personalized coaching and track your daily metrics
              </p>
            </div>
          </div>

          <InsightsDemo showCorrelations={false} className="mb-6" />

          <Button
            onClick={() => {
              setShowAICoachPopover(false);
              setShowUpgradePopover(true);
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          >
            <ScanFace size={16} className="mr-2" />
            Try AI Coaching Free
          </Button>
        </div>
      </AppleLikePopover>

      {/* Feedback Modal */}
      <FeedbackPopover
        email={currentUser?.email || ""}
        onClose={() => setIsFeedbackOpen(false)}
        isEmailEditable={!currentUser?.email}
        open={isFeedbackOpen}
      />
    </div>
  );
};

export default HomePage;
