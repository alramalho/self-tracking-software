import React, { useEffect, useState, useRef } from "react";
import {
  useUserPlan,
  ActivityEntry,
  Activity,
  User,
  TaggedActivityEntry,
} from "@/contexts/UserPlanContext";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import {
  differenceInDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import { useRouter } from "next/navigation";
import {
  Bell,
  Loader2,
  PersonStandingIcon,
  ScanFace,
  Search,
  Send,
  UserPlus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";
import { toast } from "react-hot-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "./ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import AINotification from "./AINotification";
import { useUpgrade } from "@/contexts/UpgradeContext";
import AppleLikePopover from "./AppleLikePopover";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { AccountabilityStepCard } from "./AccountabilityStepCard";
import { WeekMetricBarChart } from "./WeekMetricBarChart";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";

function isInCurrentWeek(date: string) {
  const entryDate = new Date(date);
  const today = new Date();
  return isWithinInterval(entryDate, {
    start: startOfWeek(today),
    end: endOfWeek(today),
  });
}

const TimelineRenderer: React.FC<{
  onOpenSearch: () => void;
}> = ({ onOpenSearch }) => {
  const { useTimelineDataQuery, useCurrentUserDataQuery } = useUserPlan();
  const timelineDataQuery = useTimelineDataQuery();
  const timelineData = timelineDataQuery.data;
  const { data: userData } = useCurrentUserDataQuery();
  const router = useRouter();
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const { isAppInstalled, isPushGranted, requestPermission } =
    useNotifications();
  const { setShowUpgradePopover } = useUpgrade();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { userPaidPlanType } = usePaidPlan();
  const isUserOnFreePlan = userPaidPlanType === "free";
  const [isPartnerSectionCollapsed, setIsPartnerSectionCollapsed] =
    useLocalStorage<boolean>("partner-section-collapsed", false);
  const timelineRef = useRef<HTMLDivElement>(null);

  if (!timelineDataQuery.isFetched && !timelineData) {
    return (
      <div className="flex justify-center items-center w-full">
        <Loader2 className="animate-spin text-gray-500" />
        <p className="text-gray-500 text-lg ml-3">Loading timeline...</p>
      </div>
    );
  }


  if (!userData?.user?.friendIds?.length) {
    const demoMetrics: Array<{
      emoji: string;
      name: string;
      trend: string;
      data: number[];
      bgColor:
        | "yellow"
        | "blue"
        | "green"
        | "rose"
        | "pink"
        | "red"
        | "orange"
        | "amber"
        | "purple"
        | "gray";
      correlations: string[];
    }> = [
      {
        emoji: "😊",
        name: "Happiness",
        trend: "+15%",
        data: [4, 3, 5, 4, 1, 3, 5],
        bgColor: "blue",
        correlations: ["🏃‍♂️ Exercise", "🧘‍♂️ Meditation"],
      },
      {
        emoji: "⚡",
        name: "Energy",
        trend: "+8%",
        data: [3, 4, 3, 5, 4, 3, 4],
        bgColor: "yellow",
        correlations: ["☕ Morning routine"],
      },
    ];

    return (
      <>
        {/* <AINotification
          messages={[
            "Hey There! I'm Jarvis, your helper assistant throughout tracking.so. ",
            "I see you haven't added any friends yet... statistically, you'll have **95%** more chances of success if you do, you know? Also, this timeline would get prettier 😅",
            "Here's a how you could do it:",
          ]}
          createdAt={new Date().toISOString()}
        /> */}
        <div className="mt-6 grid grid-cols-1 gap-6">
          {/* Find your Accountability Partner Card */}
          <div className="ring-2 ring-gray-200 backdrop-blur-sm rounded-lg bg-white/60 shadow-sm p-4">
            <Collapsible
              open={!isPartnerSectionCollapsed}
              onOpenChange={(open) => setIsPartnerSectionCollapsed(!open)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <button
                      className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                      aria-label={
                        isPartnerSectionCollapsed
                          ? "Expand partner section"
                          : "Collapse partner section"
                      }
                    >
                      {isPartnerSectionCollapsed ? (
                        <ChevronRight size={16} className="text-gray-600" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-600" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Find your Accountability Partner
                  </h3>
                </div>
              </div>

              {/* Always show summary in collapsed state */}
              <div className="space-y-3">
                {/* Partner overview - always visible */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus size={20} className="text-blue-500" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">
                        Improve your success rate by{" "}
                      </span>
                      <span className="font-bold text-blue-600">95%</span>
                    </div>
                  </div>
                </div>

                {/* Expandable detailed content */}
                <CollapsibleContent className="space-y-0 pb-4 pt-0">
                  <div className="space-y-4 pt-4">
                    <p className="text-gray-600 text-sm">
                      Improve your chances of success by finding an
                      accountability partner
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={shareOrCopyReferralLink}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <Send size={16} className="mr-2" />
                        Invite Friends
                      </Button>
                      <Button
                        onClick={onOpenSearch}
                        variant="outline"
                        className="flex-1"
                      >
                        <Search size={16} className="mr-2" />
                        Search Users
                      </Button>
                      <Button
                        onClick={() => router.push("/looking-for-ap")}
                        variant="outline"
                        className="flex-1"
                      >
                        <PersonStandingIcon size={16} className="mr-2" />
                        Browse Community
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Expanded AI Coach Card */}
          {isUserOnFreePlan && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <ScanFace size={30} className="text-purple-500" />
                <div>
                  <h3 className="text-lg font-semibold">AI Coach & Insights</h3>
                  <p className="text-gray-600 text-sm">
                    Get personalized coaching and track your daily metrics
                  </p>
                </div>
              </div>

              {/* Demo Metrics Preview */}
              <div className="space-y-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Preview: Track metrics like happiness, energy & productivity
                </div>

                {demoMetrics.map((metric) => (
                  <div
                    key={metric.name}
                    className="bg-white/60 rounded-lg p-4 border border-white/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {metric.emoji} {metric.name}
                      </span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        {metric.trend} this week
                      </span>
                    </div>
                    <WeekMetricBarChart
                      data={metric.data}
                      color={metric.bgColor}
                    />
                    <div className="text-xs text-gray-600">
                      {metric.correlations.map((correlation, i) => (
                        <span key={correlation}>
                          <span className="text-green-600">{correlation}</span>
                          {i < metric.correlations.length - 1
                            ? " and "
                            : " boost your " + metric.name.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setShowUpgradePopover(true)}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
              >
                <ScanFace size={16} className="mr-2" />
                Try AI Coaching Free
              </Button>
            </div>
          )}
        </div>
      </>
    );
  }

  const sortedEntries = [
    ...(timelineData?.recommendedActivityEntries || []),
  ].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (sortedEntries.length === 0) {
    return (
      <div className="text-start text-gray-500 pt-2">
        Your friends have not logged anything yet...
        <br />
        {isPushGranted ? (
          <span className="text-sm text-gray-400">
            Maybe you could go ahead and poke them?
          </span>
        ) : (
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-400">
              Turn on notifications to know when they do
            </span>
            <Button
              className="mt-3"
              onClick={() => {
                if (isDesktop || !isAppInstalled) {
                  router.push("/download");
                } else {
                  requestPermission();
                }
              }}
            >
              <Bell className="w-4 h-4 mr-2" /> Turn on notifications
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={timelineRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <h2 className="text-lg font-semibold mt-4">
        Friend&apos;s last activities
      </h2>

      {timelineDataQuery.isFetched &&
        timelineData?.recommendedActivities &&
        timelineData?.recommendedUsers &&
        sortedEntries.map((entry: TaggedActivityEntry) => {
          const activity: Activity | undefined =
            timelineData?.recommendedActivities?.find(
              (a: Activity) => a.id === entry.activityId
            );
          const user: User | undefined = timelineData?.recommendedUsers?.find(
            (u: User) => u.id === activity?.userId
          );
          if (!activity) return null;

          const daysUntilExpiration =
            entry.image && entry.image.expires_at
              ? differenceInDays(new Date(entry.image.expires_at), new Date())
              : 0;
          const hasImageExpired =
            !entry.image ||
            !entry.image.expires_at ||
            new Date(entry.image.expires_at) < new Date();

          return (
            <React.Fragment key={entry.id}>
              <ActivityEntryPhotoCard
                key={entry.id}
                imageUrl={entry.image?.url}
                activityEntryId={entry.id}
                activityTitle={activity.title}
                activityEmoji={activity.emoji || ""}
                activityEntryQuantity={entry.quantity}
                activityEntryReactions={entry.reactions || {}}
                activityEntryTimezone={entry.timezone}
                activityEntryComments={entry.comments}
                activityMeasure={activity.measure}
                isoDate={entry.date}
                description={entry.description}
                userPicture={user?.picture}
                daysUntilExpiration={daysUntilExpiration}
                hasImageExpired={hasImageExpired}
                userName={user?.name}
                userUsername={user?.username}
                onAvatarClick={() => {
                  router.push(`/profile/${user?.username}`);
                }}
                onUsernameClick={() => {
                  router.push(`/profile/${user?.username}`);
                }}
              />
              {entry.isWeekFinisher && isInCurrentWeek(entry.date) && (
                <WeeklyCompletionCard
                  key={`${entry.id}-completion`}
                  small
                  username={user?.name}
                  planName={entry.planFinishedName}
                />
              )}
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default TimelineRenderer;
