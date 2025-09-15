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
  Hammer,
  RefreshCcw,
  ScanFace
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";

import { ProgressRing } from "@/components/ProgressRing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/contexts/activities";
import { useGlobalDataOperations } from "@/contexts/GlobalDataProvider";
import { useMetrics } from "@/contexts/metrics";
import { useDataNotifications } from "@/contexts/notifications";
import { usePlans } from "@/contexts/plans";
import { usePlansProgress } from "@/contexts/PlansProgressContext";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useCurrentUser } from "@/contexts/users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useSession } from "@clerk/clerk-react";
import { isAfter } from "date-fns";

const HomePage: React.FC = () => {
  const { currentUser, hasLoadedUserData } = useCurrentUser();
  const router = useRouter();

  const { notifications, clearAllNotifications } = useDataNotifications();
  const { plans } = usePlans();
  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const _ = usePlansProgress(activePlans?.map((plan) => plan.id) || []); // force refetch prior to timeline to speed up plan show
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

  const unreadNotifications =
    notifications?.filter(
      (n) => n.status !== "CONCLUDED" && n.type !== "ENGAGEMENT"
    ) || [];

  const unreadNotificationsCount = unreadNotifications.length;
  const { activityEntries } = useActivities();
  const totalActivitiesLogged = activityEntries?.length || 0;
  const accountLevel = useAccountLevel(totalActivitiesLogged);

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
  };

  if (
    isLoaded &&
    isSignedIn &&
    (!hasLoadedUserData || !currentUser?.onboardingCompletedAt)
  ) {
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
          <div className={`flex justify-between items-center`}>
            <div className="flex flex-row gap-1 items-center text-center">
              <ProgressRing
                size={50}
                strokeWidth={4}
                atLeastBronze={accountLevel.atLeastBronze}
                percentage={accountLevel.percentage}
                currentLevel={accountLevel.currentLevel}
                badge={false}
                onClick={() => router.push(`/profile/${currentUser?.username}`)}
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

          <div
            onClick={() => setIsFeedbackOpen(true)}
            className="ring-1 ring-gray-200 backdrop-blur-md bg-white/30 rounded-3xl py-3 px-4 shadow-sm cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Hammer size={40} className="text-gray-500" />
                <div>
                  <span className="text-sm font-semibold text-gray-700">
                    We&apos;re updating the app!
                  </span>
                  <p className="text-xs text-gray-600">
                    If anything is broken, please let us know.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {activePlans && activePlans.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activePlans.length > 1 && (
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
                  )}
                  <div className="flex flex-row items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Your Plans
                    </h3>
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
              <div className="mt-2">
                <PlansProgressDisplay isExpanded={!isPlansCollapsed} />
              </div>
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
