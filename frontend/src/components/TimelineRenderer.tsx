import React, { useEffect, useState } from "react";
import {
  useUserPlan,
  ActivityEntry,
  Activity,
  User,
} from "@/contexts/UserPlanContext";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { format, differenceInDays } from "date-fns";
import { useApiWithAuth } from "@/api";
import {isBefore} from "date-fns"
import { useRouter } from "next/navigation";

const TimelineRenderer: React.FC = () => {
  const { userData } = useUserPlan();
  const router = useRouter();

  if (!userData || !userData["me"]) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {userData &&
        userData["me"].recommendedActivityEntries &&
        userData["me"].recommendedActivities &&
        userData["me"].recommendedActivityEntries.map(
          (entry: ActivityEntry) => {
            if (!entry.image?.expires_at) {
              return null;
            }
            if (isBefore(new Date(entry.image.expires_at), new Date())) {
              console.log("Image expired");
              console.log(entry.image.expires_at);
              console.log(new Date());
              return null;
            }
            const activity: Activity | undefined = userData["me"].recommendedActivities!.find((a) => a.id === entry.activity_id);
            const user: User | undefined = userData["me"].recommendedUsers!.find((u) => u.id === activity?.user_id);
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
                activityEntryQuantity={entry.quantity}
                activityMeasure={activity.measure}
                formattedDate={formattedDate}
                daysUntilExpiration={daysUntilExpiration}
                userPicture={user?.picture}
                userName={user?.name}
                onClick={() => {
                  router.push(`/profile/${user?.username}`);
                }}
              />
            );
          }
        )}
    </div>
  );
};

export default TimelineRenderer;
