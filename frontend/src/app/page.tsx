"use client";

import React, { useEffect, useState } from "react";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { useRouter } from "next/navigation";
import TimelineRenderer from "@/components/TimelineRenderer";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Search, Bell, ChevronDown, ChevronRight } from "lucide-react";
import Notifications from "@/components/Notifications";
import { Button } from "@/components/ui/button";
import PlanStreak from "@/components/PlanStreak";
import { WeekMetricBarChart } from "@/components/WeekMetricBarChart";

import { useSession } from "@clerk/nextjs";
import { useUserPlan, MetricEntry } from "@/contexts/UserPlanContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import Link from "next/link";
import { useMetrics } from "@/hooks/useMetrics";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import AINotification from "@/components/AINotification";
import { usePaidPlan } from "@/hooks/usePaidPlan";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();
  const router = useRouter();
  const { useCurrentUserDataQuery, hasLoadedUserData, notificationsData } =
    useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
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
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { isAppInstalled, clearGeneralNotifications } = useNotifications();
  const { userPaidPlanType } = usePaidPlan();
  const isUserOnFreePlan = userPaidPlanType === "free";
  const currentHour = new Date().getHours();

  const {
    show: showDailyCheckin,
    hasMissingCheckin,
    checkinMessage,
  } = useDailyCheckin();
  const [onboardingCompleted] = useLocalStorage<boolean>(
    "onboarding-completed",
    false
  );

  const hasFriends =
    userData?.user?.friend_ids?.length &&
    userData?.user?.friend_ids?.length > 0;

  const unreadNotifications =
    notificationsData.data?.notifications?.filter(
      (n) => n.status !== "concluded" && n.type !== "engagement"
    ) || [];
  const unreadNotificationsCount = unreadNotifications.length;

  useEffect(() => {
    if (
      isSignedIn &&
      hasLoadedUserData &&
      !onboardingCompleted &&
      !hasFriends
    ) {
      router.push("/onboarding");
    }
  }, [userData, isSignedIn]);

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
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
      <div
        className={`flex justify-between items-center ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4`}
      >
        {isAppInstalled ? (
          <div className="flex flex-row gap-3 items-center text-center">
            <span className="mb-2 text-[40px]">🎯</span>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              <span className={`${variants.text} break-normal text-nowrap`}>
                tracking.<span className={`${variants.fadedText}`}>so</span>
              </span>
            </h2>
          </div>
        ) : (
          <Link href="/download">
            <Button>Download App</Button>
          </Link>
        )}
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

      {/* Plan Streaks Section */}
      {userData?.plans && userData.plans.length > 0 && (
        <div className="ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Your Streaks
            </h3>
            <button
              onClick={() => router.push(`/profile/${userData.user?.username}`)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              View Details
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {userData.plans.map((plan) => (
              <PlanStreak
                key={plan.id}
                plan={plan}
                activities={userData.activities || []}
                activityEntries={userData.activityEntries || []}
                size="medium"
                timeRangeDays={60}
                onClick={() =>
                  router.push(`/profile/${userData.user?.username}`)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Your Metrics Section */}
      {userMetrics.length > 0 && !isUserOnFreePlan && (
        <div className="ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMetricsCollapsed(!isMetricsCollapsed)}
                className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                aria-label={isMetricsCollapsed ? "Expand metrics" : "Collapse metrics"}
              >
                {isMetricsCollapsed ? (
                  <ChevronRight size={16} className="text-gray-600" />
                ) : (
                  <ChevronDown size={16} className="text-gray-600" />
                )}
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                Your Metrics
              </h3>
            </div>
            <button
              onClick={() => router.push("/insights/dashboard")}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              View Insights
              <ChevronRight size={16} />
            </button>
          </div>
          
          {isMetricsCollapsed ? (
            // Minimal collapsed version
            <div className="space-y-3">
              {/* Missing checkin indicator */}
              {hasMissingCheckin && currentHour > 14 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-sm font-medium">Missing check-in</span>
                  <button
                    onClick={() => showDailyCheckin()}
                    className="text-xs text-amber-700 hover:text-amber-800 font-medium ml-auto"
                  >
                    Check in now
                  </button>
                </div>
              )}
              
              {/* Metrics overview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Progress indicator */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {userMetrics.filter(metric => {
                        const today = new Date().toISOString().split("T")[0];
                        return entries.some(
                          (entry: MetricEntry) =>
                            entry.metric_id === metric.id && entry.date.split("T")[0] === today
                        );
                      }).length}
                    </span>
                    <span className="text-gray-500"> of {userMetrics.length} logged today</span>
                  </div>
                  
                  {/* Metric icons with status indicators */}
                  <div className="flex items-center gap-1">
                    {userMetrics.slice(0, 5).map((metric) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isLoggedToday = entries.some(
                        (entry: MetricEntry) =>
                          entry.metric_id === metric.id && entry.date.split("T")[0] === today
                      );
                      
                      return (
                        <div
                          key={metric.id}
                          className="relative flex items-center justify-center"
                        >
                          <span 
                            className={`text-lg transition-opacity duration-200 ${
                              isLoggedToday ? 'opacity-100' : 'opacity-40'
                            }`}
                            title={`${metric.title} ${isLoggedToday ? '(logged today)' : '(not logged today)'}`}
                          >
                            {metric.emoji}
                          </span>
                          {isLoggedToday && (
                            <div className="absolute -bottom-0 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
                          )}
                        </div>
                      );
                    })}
                    {userMetrics.length > 5 && (
                      <span className="text-xs text-gray-400 ml-1">
                        +{userMetrics.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Expanded version (existing code)
            <div className="space-y-4">
              {hasMissingCheckin && (
                <AINotification
                  messages={[checkinMessage ?? ""]}
                  hasNotification={false}
                  createdAt={new Date().toISOString()}
                  replyMessage="Check in now"
                  onClick={() => showDailyCheckin()}
                />
              )}
              {userMetrics.slice(0, 3).map((metric, index) => {
                const weekData = getMetricWeekData(metric.id);
                const hasAnyData = weekData.some((val) => val > 0);
                const positiveCorrelations = getPositiveCorrelations(metric.id);

                return (
                  <div
                    key={metric.id}
                    className="bg-gray-100/60 rounded-lg p-4 border border-white/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {metric.emoji} {metric.title}
                      </span>
                      <span className="text-xs text-gray-500">Last 7 days</span>
                    </div>
                    {hasAnyData ? (
                      <WeekMetricBarChart
                        data={weekData}
                        color={getMetricColor(index)}
                      />
                    ) : (
                      <div className="py-2 text-center">
                        <p className="text-sm text-gray-500">
                          No data this week.{" "}
                          <button
                            onClick={() => showDailyCheckin()}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Check in now
                          </button>
                        </p>
                      </div>
                    )}
                    {positiveCorrelations.length > 0 && (
                      <div className="text-xs text-gray-600 mt-3">
                        {positiveCorrelations
                          .slice(0, 2)
                          .map((correlation, i) => (
                            <span key={correlation.activity.id}>
                              <span className="text-green-600">
                                {formatCorrelationString(correlation)}
                              </span>
                              {i < Math.min(positiveCorrelations.length - 1, 1)
                                ? " and "
                                : ` boost your ${metric.title.toLowerCase()}`}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
    </div>
  );
};

export default HomePage;
