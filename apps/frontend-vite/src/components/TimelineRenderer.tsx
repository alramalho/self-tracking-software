import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { useActivities } from "@/contexts/activities/useActivities";
import { useTimeline } from "@/contexts/timeline/useTimeline";
import { useCurrentUser } from "@/contexts/users";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useNavigate } from "@tanstack/react-router";
import { type Activity, type PlanType } from "@tsw/prisma";
import { Bell, RefreshCcw, Squirrel } from "lucide-react";
import React, { useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

const TimelineRenderer: React.FC<{
  onOpenSearch: () => void;
}> = ({ onOpenSearch }) => {
  const { timelineData, isLoadingTimeline } = useTimeline();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
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
      <div className="flex flex-col items-center gap-3 text-center text-gray-500 pt-2">
        <Squirrel className="w-24 h-24 text-muted-foreground mx-auto" />
        <div>
          <h3 className="text-lg text-gray-800 font-semibold">Uh oh...</h3>
          <p className="text-sm text-gray-400">
            You haven't added any friends yet...
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: "/search" })}
          className="mt-2"
        >
          Find Friends
        </Button>
      </div>
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
                  navigate({
                    to: "/download",
                    search: { instagram: false, tiktok: false },
                  });
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
      <div className="flex items-center justify-start mt-4">
        <h2 className="mt-0 text-lg font-semibold">
          Friend&apos;s last activities
        </h2>
        {isLoadingTimeline && (
          <span>
            <RefreshCcw className={`w-4 h-4 ml-2 animate-spin`} />
          </span>
        )}
      </div>

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

          // Get plan progress data for this user's plans from inline data
          const timelineUser = timelineData?.recommendedUsers?.find(
            (u) => u.id === user.id
          );
          const userPlansProgress =
            timelineUser?.plans
              ?.filter((plan) =>
                plan.activities?.some((a) => a.id === activity?.id)
              )
              .map((plan) => plan.progress) || [];

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
                userPlansProgressData={userPlansProgress}
                onAvatarClick={() => {
                  navigate({
                    to: `/profile/$username`,
                    params: { username: user?.username || "" },
                  });
                }}
                onUsernameClick={() => {
                  navigate({
                    to: `/profile/$username`,
                    params: { username: user?.username || "" },
                  });
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
