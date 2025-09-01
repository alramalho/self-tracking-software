"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import FeedbackPopover from "@/components/FeedbackPopover";
import InsightsDemo from "@/components/InsightsDemo";
import { MetricIsland } from "@/components/MetricIsland";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";
import Notifications from "@/components/Notifications";
import { PlansProgressDisplay } from "@/components/PlansProgressDisplay";
import TimelineRenderer from "@/components/TimelineRenderer";
import { TodaysNoteSection } from "@/components/TodaysNoteSection";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MetricEntry } from "@tsw/prisma";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  RefreshCcw,
  ScanFace,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import PullToRefresh from "react-simple-pull-to-refresh";

import PlanProgressPopover from "@/components/profile/PlanProgresPopover";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMetrics } from "@/hooks/useMetrics";
import { useNotifications } from "@/hooks/useNotifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { isToday } from "date-fns";
import { getUser } from "./actions";

const HomePage: React.FC = () => {
  const router = useRouter();
  const { useCurrentUserDataQuery, notificationsData, refetchAllData } =
    useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const {
    userMetrics,
    entries,
    getMetricWeekData,
    getPositiveCorrelations,
    formatCorrelationString,
  } = useMetrics();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const isUserOnFreePlan = userPaidPlanType === "FREE";
  const [showPlanProgressExplainer, setShowPlanProgressExplainer] =
    useState(false);
  const [showAICoachPopover, setShowAICoachPopover] = useState(false);

  const unreadNotifications =
    notificationsData.data?.notifications?.filter(
      (n) => n.status !== "CONCLUDED" && n.type !== "ENGAGEMENT"
    ) || [];
  const unreadNotificationsCount = unreadNotifications.length;

  const { areAllMetricsCompleted } = useDailyCheckin();


  useEffect(() => {
    const fetchUser = async () => {
      console.log(`Fetching user ${userData?.id}`);
      const user = await getUser();

      console.log(`User fetched from prisma! ${user?.id}`);
    };
    fetchUser();
  }, [userData]);

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

            <PlansProgressDisplay isExpanded={!isPlansCollapsed} />
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
                        entry.metricId === metric.id && isToday(entry.date)
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
          <TimelineRenderer onOpenSearch={() => router.push("/ap-search")} />
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
          email={userData?.email || ""}
          onClose={() => setIsFeedbackOpen(false)}
          isEmailEditable={!userData?.email}
          open={isFeedbackOpen}
        />
      </div>
    </PullToRefresh>
  );
};

export default HomePage;
