import React, { useEffect } from "react";
import {
  useUserPlan,
  ActivityEntry,
  Activity,
  User,
  TaggedActivityEntry,
} from "@/contexts/UserPlanContext";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { format, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { toast } from "react-hot-toast";

function isInCurrentWeek(date: string) {
  const entryDate = new Date(date);
  const today = new Date();
  return isWithinInterval(entryDate, { start: startOfWeek(today), end: endOfWeek(today) });
}

const TimelineRenderer: React.FC<{ onOpenSearch: () => void }> = ({ onOpenSearch }) => {
  const { timelineData, hasLoadedTimelineData } = useUserPlan();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const router = useRouter();

  useEffect(() => {
    timelineData.refetch();
  }, []);

  if (!hasLoadedTimelineData) {
    return (
      <div className="flex justify-center items-center w-full">
        <Loader2 className="animate-spin text-gray-500" />
        <p className="text-gray-500 text-lg ml-3">Loading timeline...</p>
      </div>
    );
  }


  const sortedEntries = [...(timelineData.data?.recommendedActivityEntries || [])].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {timelineData.isFetched && timelineData.data?.recommendedActivities &&
        timelineData.data?.recommendedUsers &&
        sortedEntries.map((entry: TaggedActivityEntry) => {
          const activity: Activity | undefined = timelineData.data!.recommendedActivities!.find(
            (a: Activity) => a.id === entry.activity_id
          );
          const user: User | undefined = timelineData.data!.recommendedUsers!.find(
            (u: User) => u.id === activity?.user_id
          );
          if (!activity) return null;

          const daysUntilExpiration =
            entry.image && entry.image.expires_at
              ? differenceInDays(new Date(entry.image.expires_at), new Date())
              : 0;
          const hasImageExpired = !entry.image || !entry.image.expires_at || new Date(entry.image.expires_at) < new Date();

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
              {entry.is_week_finisher && isInCurrentWeek(entry.date) && (
                <WeeklyCompletionCard
                  key={`${entry.id}-completion`}
                  small
                  username={user?.name}
                  planName={entry.plan_finished_name}
                />
              )}
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default TimelineRenderer;
