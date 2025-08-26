import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import {
  useUserPlan,
} from "@/contexts/UserGlobalContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { User } from "@tsw/prisma";
import {
  differenceInDays,
  endOfWeek,
  isWithinInterval,
  startOfWeek,
} from "date-fns";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Loader2,
  PersonStandingIcon,
  Search,
  Send,
  UserPlus
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useRef } from "react";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");
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


  if (!userData?.friends?.length) {

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
        sortedEntries.map((entry) => {
          const activity = entry.activity;
          const user: User | undefined = timelineData?.recommendedUsers?.find(
            (u: User) => u.id === activity?.userId
          );
          if (!activity) return null;

          const daysUntilExpiration =
            entry.imageUrl && entry.imageExpiresAt
              ? differenceInDays(new Date(entry.imageExpiresAt), new Date())
              : 0;
          const hasImageExpired =
            !entry.imageUrl ||
            !entry.imageExpiresAt ||
            new Date(entry.imageExpiresAt) < new Date();

          return (
            <React.Fragment key={entry.id}>
              <ActivityEntryPhotoCard
                key={entry.id}
                imageUrl={entry.imageUrl || undefined}
                activityEntryId={entry.id}
                activityTitle={activity.title}
                activityEmoji={activity.emoji || ""}
                activityEntryQuantity={entry.quantity}
                activityEntryReactions={entry.reactions.reduce((acc, reaction) => {
                  if (reaction.user.username) {
                    acc[reaction.emoji] = [reaction.user.username];
                  }
                  return acc;
                }, {} as Record<string, string[]>)}
                activityEntryTimezone={entry.timezone || undefined}
                activityEntryComments={entry.comments || []}
                activityMeasure={activity.measure}
                date={entry.date}
                description={entry.description || undefined}
                userPicture={user?.picture || undefined}
                daysUntilExpiration={daysUntilExpiration}
                hasImageExpired={hasImageExpired}
                userName={user?.name || undefined}
                userUsername={user?.username || undefined}
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
