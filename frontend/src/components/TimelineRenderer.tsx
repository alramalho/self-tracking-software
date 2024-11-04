import React from "react";
import {
  useUserPlan,
  ActivityEntry,
  Activity,
  User,
} from "@/contexts/UserPlanContext";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { format, differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const TimelineRenderer: React.FC = () => {
  const { timelineData } = useUserPlan();
  const router = useRouter();

  if (timelineData.isLoading) {
    return (
      <div className="flex justify-center items-center w-full">
        <Loader2 className="animate-spin text-gray-500" />
        <p className="text-gray-500 text-lg ml-3">Loading timeline...</p>
      </div>
    );
  }

  if (!timelineData.data) {
    return <div className="text-center mt-8">No timeline data available. Try adding some friends!</div>;
  }

  const sortedEntries = [...(timelineData.data.recommendedActivityEntries || [])].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {timelineData.isFetched && timelineData.data?.recommendedActivities &&
        timelineData.data?.recommendedUsers &&
        sortedEntries.map((entry: ActivityEntry) => {
          const activity: Activity | undefined = timelineData.data!.recommendedActivities!.find(
            (a: Activity) => a.id === entry.activity_id
          );
          const user: User | undefined = timelineData.data!.recommendedUsers!.find(
            (u: User) => u.id === activity?.user_id
          );
          if (!activity) return null;

          const formattedDate = (() => {
            const entryDate = new Date(entry.date);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (entryDate.toDateString() === today.toDateString()) {
              return "today";
            } else if (entryDate.toDateString() === yesterday.toDateString()) {
              return "yesterday";
            } else {
              return `last ${format(entryDate, "EEEE").toLowerCase()}`;
            }
          })();
          const daysUntilExpiration =
            entry.image && entry.image.expires_at
              ? differenceInDays(new Date(entry.image.expires_at), new Date())
              : 0;
          const hasImageExpired = !entry.image || !entry.image.expires_at || new Date(entry.image.expires_at) < new Date();

          return (
            <ActivityEntryPhotoCard
              key={entry.id}
              imageUrl={entry.image?.url}
              activityTitle={activity.title}
              activityEmoji={activity.emoji || ""}
              activityEntryQuantity={entry.quantity}
              activityMeasure={activity.measure}
              formattedDate={formattedDate}
              userPicture={user?.picture}
              daysUntilExpiration={daysUntilExpiration}
              hasImageExpired={hasImageExpired}
              userName={user?.name}
              userUsername={user?.username}
              onClick={() => {
                router.push(`/profile/${user?.username}`);
              }}
            />
          );
        })}
    </div>
  );
};

export default TimelineRenderer;
