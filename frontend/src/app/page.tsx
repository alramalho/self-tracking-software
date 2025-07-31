"use client";

import React, { useEffect, useState } from "react";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import PullToRefresh from "react-simple-pull-to-refresh";
import { MetricIsland } from "@/components/MetricIsland";
import { TodaysNoteSection } from "@/components/TodaysNoteSection";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";

import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  RefreshCcw,
} from "lucide-react";
import Notifications from "@/components/Notifications";
import { Button } from "@/components/ui/button";
import { WeekMetricBarChart } from "@/components/WeekMetricBarChart";
import { PlansProgressDisplay } from "@/components/PlansProgressDisplay";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { useSession } from "@clerk/nextjs";
import {
  useUserPlan,
  MetricEntry,
  convertApiPlanToPlan,
} from "@/contexts/UserPlanContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { useMetrics } from "@/hooks/useMetrics";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import PlanProgressPopover from "@/components/profile/PlanProgresPopover";

const HomePage: React.FC = () => {
  const router = useRouter();
  const {
    useCurrentUserDataQuery,
    notificationsData,
    refetchAllData,
  } = useUserPlan();
  const { data: userData } =
    useCurrentUserDataQuery();
  const {
    userMetrics,
    entries,
    getMetricWeekData,
    getPositiveCorrelations,
    formatCorrelationString,
  } = useMetrics();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useLocalStorage<boolean>(
    "metrics-section-collapsed",
    false
  );
  const [isPlansCollapsed, setIsPlansCollapsed] = useLocalStorage<boolean>(
    "plans-section-collapsed",
    false
  );
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { clearGeneralNotifications } = useNotifications();
  const { userPaidPlanType } = usePaidPlan();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const [showPlanProgressExplainer, setShowPlanProgressExplainer] =
    useState(false);

  const unreadNotifications =
    notificationsData.data?.notifications?.filter(
      (n) => n.status !== "concluded" && n.type !== "engagement"
    ) || [];
  const unreadNotificationsCount = unreadNotifications.length;

  const { areAllMetricsCompleted } = useDailyCheckin();

  const handleUserClick = (user: UserSearchResult) => {
    router.push(`/profile/${user.username}`);
    setIsSearchOpen(false);
  };

  const handleNotificationsClose = async () => {
    setIsNotificationsOpen(false);
    await clearGeneralNotifications();
    // Optionally refetch notifications to update the UI
    await notificationsData.refetch();
  };

  // Color mapping for metrics
  const getMetricColor = (index: number) => {
    const colors = [
      "blue",
      "yellow",
      "green",
      "purple",
      "rose",
      "orange",
      "amber",
      "pink",
      "red",
      "gray",
    ] as const;
    return colors[index % colors.length];
  };

  return (
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
      <div className="container mx-auto px-3 pt-3 pb-8 max-w-2xl space-y-4">
        <div
          className={`flex justify-between items-center bg-gray-100 ring-1 ring-gray-200 backdrop-blur-sm rounded-full py-2 px-4 shadow-sm`}
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
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <Search size={24} />
            </button>
          </div>
        </div>

        {userData?.plans && userData.plans.length > 0 && (
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

            <PlansProgressDisplay
              isExpanded={!isPlansCollapsed}
            />
          </div>
        )}

        {userMetrics.length > 0 && !isUserOnFreePlan && (
          <div className="">
            <Collapsible
              open={!isMetricsCollapsed}
              onOpenChange={(open) => setIsMetricsCollapsed(!open)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <button
                      className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                      aria-label={
                        isMetricsCollapsed
                          ? "Expand metrics"
                          : "Collapse metrics"
                      }
                    >
                      {isMetricsCollapsed ? (
                        <ChevronRight size={16} className="text-gray-600" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-600" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <h3 className="text-md font-semibold text-gray-900">
                    Your Metrics
                  </h3>
                </div>
                <button
                  onClick={() => router.push("/insights/dashboard")}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                >
                  View Insights
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 flex-wrap">
                  {userMetrics.slice(0, 3).map((metric, index) => {
                    const today = new Date().toISOString().split("T")[0];
                    const todaysEntry = entries.find(
                      (entry: MetricEntry) =>
                        entry.metricId === metric.id &&
                        entry.date.split("T")[0] === today
                    );
                    const isLoggedToday =
                      !!todaysEntry && todaysEntry.rating > 0;
                    const isSkippedToday = !!todaysEntry && todaysEntry.skipped;
                    const todaysRating = todaysEntry?.rating;

                    const weekData = getMetricWeekData(metric.id);
                    const hasAnyData = weekData.some((val) => val > 0);
                    const positiveCorrelations = getPositiveCorrelations(
                      metric.id
                    );

                    return (
                      <div key={`${metric.id}-${index}-homepage`}>
                        <MetricIsland
                          key={metric.id}
                          metric={metric}
                          isLoggedToday={isLoggedToday}
                          todaysRating={todaysRating}
                          isSkippedToday={isSkippedToday}
                        />
                        <CollapsibleContent>
                          <MetricWeeklyView
                            metric={metric}
                            weekData={weekData}
                            color={getMetricColor(index)}
                            hasAnyData={hasAnyData}
                            positiveCorrelations={positiveCorrelations}
                            formatCorrelationString={formatCorrelationString}
                          />
                        </CollapsibleContent>
                      </div>
                    );
                  })}
                  {areAllMetricsCompleted && <TodaysNoteSection />}
                </div>

                {userMetrics.length > 3 && (
                  <div className="text-center">
                    <button
                      onClick={() => router.push("/insights/dashboard")}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      +{userMetrics.length - 3} more metrics
                    </button>
                  </div>
                )}
              </div>
            </Collapsible>
          </div>
        )}

        <div className="mb-6">
          <TimelineRenderer onOpenSearch={() => setIsSearchOpen(true)} />
        </div>

        <AppleLikePopover
          onClose={() => setIsSearchOpen(false)}
          open={isSearchOpen}
          title="Search Users"
        >
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Search Users</h2>
            <UserSearch onUserClick={handleUserClick} />
          </div>
        </AppleLikePopover>

        <AppleLikePopover
          onClose={handleNotificationsClose}
          open={isNotificationsOpen}
          title="Notifications"
          displayIcon={false}
        >
          {unreadNotificationsCount == 0 && (
            <div className="flex items-start flex-col justify-between mb-4">
              <h2 className="text-xl font-semibold">✅ No new notifications</h2>
            </div>
          )}
          <Notifications />
        </AppleLikePopover>

        {/* <DailyCheckinBanner/> */}

        <PlanProgressPopover
          open={showPlanProgressExplainer}
          onClose={() => {
            setShowPlanProgressExplainer(false);
          }}
        />
      </div>
    </PullToRefresh>
  );
};

export default HomePage;
