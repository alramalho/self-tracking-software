import React, { useEffect } from "react";
import {
  useUserPlan,
  ActivityEntry,
  Activity,
  User,
  TaggedActivityEntry,
} from "@/contexts/UserPlanContext";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";

function isInCurrentWeek(date: string) {
  const entryDate = new Date(date);
  const today = new Date();
  return isWithinInterval(entryDate, { start: startOfWeek(today), end: endOfWeek(today) });
}

const TimelineRenderer: React.FC<{ onOpenSearch: () => void }> = ({ onOpenSearch }) => {
  const { timelineData, hasLoadedTimelineData } = useUserPlan();
  // const { data: userData } = useCurrentUserDataQuery();
  const router = useRouter();
  // const { isSupported: isShareSupported, share } = useShare();
  // const [copied, copyToClipboard] = useClipboard();

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

  // if (!userData?.user?.friend_ids?.length) {
  //   return (
  //     <div className="text-left text-gray-500">
  //       You haven&apos;t added any friends yet 🙁
  //       <br />
  //       <span className="text-sm text-gray-500">
  //         Studies show that having accountability partners{" "}
  //         <span className="font-bold">increases your chances of achieving goals by up to 95%!</span>
  //         <br />
  //         <br />
  //         Add friends to boost your success.
  //       </span>
  //       <span className="text-sm text-gray-500">
  //         <br />
  //         <br />
  //         <span
  //           className="underline cursor-pointer"
  //           onClick={onOpenSearch}
  //         >
  //           Search
  //         </span>{" "}
  //         for friends already using tracking.so, or invite new ones by{" "}
  //         <span
  //           className="underline cursor-pointer"
  //           onClick={async () => {
  //             try {
  //               const link = `https://app.tracking.so/join/${userData?.user?.username}`;
  //               if (isShareSupported) {
  //                 const success = await share(link);
  //                 if (!success) throw new Error("Failed to share");
  //               } else {
  //                 const success = await copyToClipboard(link);
  //                 if (!success) throw new Error("Failed to copy");
  //                 toast.success("Copied to clipboard");
  //               }
  //             } catch (error) {
  //               console.error("Failed to copy link to clipboard");
  //             }
  //           }}
  //         >
  //           sharing your profile link.
  //         </span>
  //       </span>
  //     </div>
  //   );
  // }

  const sortedEntries = [...(timelineData.data?.recommendedActivityEntries || [])].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (sortedEntries.length === 0) {
    return (
      <div className="text-start text-gray-500 pt-2">
        Your friends have not yet logged anything..
        <br />
        Maybe you could help them get motivated?
      </div>
    );
  }

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
                activityEntryTimezone={entry.timezone}
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
