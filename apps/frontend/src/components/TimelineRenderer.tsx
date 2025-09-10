import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { useActivities } from "@/contexts/activities";
import { useTimeline } from "@/contexts/timeline";
import { useCurrentUser } from "@/contexts/users";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { Activity, PlanType } from "@tsw/prisma";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  PersonStandingIcon,
  Search,
  Send,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useRef } from "react";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Skeleton } from "./ui/skeleton";

const TimelineRenderer: React.FC<{
  onOpenSearch: () => void;
}> = ({ onOpenSearch }) => {
  const { timelineData, isLoadingTimeline } = useTimeline();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const { isAppInstalled, isPushGranted, requestPermission } =
    useNotifications();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isPartnerSectionCollapsed, setIsPartnerSectionCollapsed] =
    useLocalStorage<boolean>("partner-section-collapsed", false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { activities } = useActivities();

  const friends = useMemo(() => {
    return [
      ...(currentUser?.connectionsFrom
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.to) || []),
      ...(currentUser?.connectionsTo
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.from) || []),
    ];
  }, [currentUser?.connectionsFrom, currentUser?.connectionsTo]);

  if (isLoadingTimeline && !timelineData) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/50 backdrop-blur-sm border rounded-2xl overflow-hidden"
          >
            <div className="relative max-h-full max-w-full mx-auto p-4 pb-0">
              <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg shadow-lg border border-white/20">
                <Skeleton className="w-full h-[300px] rounded-2xl" />
              </div>
            </div>
            <div className="p-4 flex flex-col flex-nowrap items-start justify-between">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex flex-col space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!friends?.length) {
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
          <div className="ring-2 ring-gray-200 backdrop-blur-sm rounded-2xl bg-white/60 shadow-sm p-4">
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
                        onClick={() => router.push("/ap-search")}
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
        </div>
      </>
    );
  }

  if (timelineData?.recommendedActivityEntries.length === 0) {
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

      {!isLoadingTimeline &&
        timelineData?.recommendedActivities &&
        timelineData?.recommendedUsers &&
        timelineData?.recommendedActivityEntries.map((entry) => {
          const allActivities = [
            ...(timelineData?.recommendedActivities || []),
            ...activities,
          ];
          const activity = allActivities?.find(
            (a: Activity) => a.id === entry.activityId
          );
          const allUsers = [
            ...(timelineData?.recommendedUsers || []),
            currentUser,
          ];
          const user = allUsers?.find((u: any) => u.id === activity?.userId);
          // wacky casting, should be dealt in the query level
          if (!activity || !user || user.username === null) return null;

          return (
            <React.Fragment key={entry.id}>
              <ActivityEntryPhotoCard
                key={entry.id}
                activity={activity}
                activityEntry={entry as any}
                user={
                  user as {
                    username: string;
                    name: string;
                    picture: string;
                    planType: PlanType;
                  }
                }
                onAvatarClick={() => {
                  router.push(`/profile/${user?.username}`);
                }}
                onUsernameClick={() => {
                  router.push(`/profile/${user?.username}`);
                }}
              />
              {/* {entry.isWeekFinisher && isInCurrentWeek(entry.date) && (
                <WeeklyCompletionCard
                  key={`${entry.id}-completion`}
                  small
                  username={user?.name}
                  planName={entry.planFinishedName}
                />
              )} */}
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default TimelineRenderer;
