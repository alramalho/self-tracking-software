import React, { useEffect, useState } from "react";
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
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const { timelineData, fetchTimelineData } = useUserPlan();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setIsTimelineLoading(true);
      await fetchTimelineData();
      setIsTimelineLoading(false);
    };
    fetchData();
  }, [fetchTimelineData]);

  useEffect(() => {
    console.log("Timeline data:", timelineData);
  }, [timelineData]);

  if (isTimelineLoading) {
    return (
      <div className="flex justify-center items-center w-full">
        <Loader2 className="animate-spin text-gray-500" />
        <p className="text-gray-500 text-lg ml-3">Loading timeline...</p>
      </div>
    );
  }

  if (!timelineData) {
    return <div className="text-center mt-8">No timeline data available.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {timelineData.recommendedActivityEntries &&
        timelineData.recommendedActivities &&
        timelineData.recommendedUsers &&
        timelineData.recommendedActivityEntries.map((entry: ActivityEntry) => {
          const activity: Activity | undefined = timelineData.recommendedActivities!.find(
            (a) => a.id === entry.activity_id
          );
          const user: User | undefined = timelineData.recommendedUsers!.find(
            (u) => u.id === activity?.user_id
          );
          if (!activity) return null;

          const formattedDate = format(new Date(entry.date), "MMM d, yyyy");
          const daysUntilExpiration =
            entry.image && entry.image.expires_at
              ? differenceInDays(new Date(entry.image.expires_at), new Date())
              : 0;

          return (
            <ActivityEntryPhotoCard
              key={entry.id}
              imageUrl={entry.image?.url}
              activityTitle={activity.title}
              activityEmoji={activity.emoji || ""}
              activityEntryQuantity={entry.quantity}
              activityMeasure={activity.measure}
              formattedDate={formattedDate}
              daysUntilExpiration={daysUntilExpiration}
              userPicture={user?.picture}
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
