import React, { useEffect, useState } from "react";
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
import { Bell, Loader2, ScanFace, Search, Send, UserPlus } from "lucide-react";
import { WeeklyCompletionCard } from "./WeeklyCompletionCard";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { toast } from "react-hot-toast";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "./ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import AINotification from "./AINotification";
import { AccountabilityStepCard } from "@/app/onboarding/page";
import { useUpgrade } from "@/contexts/UpgradeContext";
import AppleLikePopover from "./AppleLikePopover";
import { Avatar, AvatarFallback } from "./ui/avatar";

function isInCurrentWeek(date: string) {
  const entryDate = new Date(date);
  const today = new Date();
  return isWithinInterval(entryDate, {
    start: startOfWeek(today),
    end: endOfWeek(today),
  });
}

const TimelineRenderer: React.FC<{ onOpenSearch: () => void }> = ({
  onOpenSearch,
}) => {
  const { timelineData, hasLoadedTimelineData, useCurrentUserDataQuery } =
    useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const router = useRouter();
  const { isSupported: isShareSupported, share } = useShare();
  const [copied, copyToClipboard] = useClipboard();
  const { isAppInstalled, isPushGranted, requestPermission } =
    useNotifications();
  const { setShowUpgradePopover } = useUpgrade();
  const isDesktop = useMediaQuery("(min-width: 768px)");

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

  const handleShareReferralLink = async () => {
    const link = `https://app.tracking.so/join/${userData?.user?.username}`;

    try {
      if (isShareSupported) {
        const success = await share(link);
        if (!success) throw new Error("Failed to share");
      } else {
        const success = await copyToClipboard(link);
        if (!success) throw new Error("Failed to copy");
      }
    } catch (error) {
      console.error("Error sharing referral link:", error);
      toast.error("Failed to share referral link. Maybe you cancelled it?");
    }
  };

  if (!userData?.user?.friend_ids?.length) {
    return (
      <>
        <AINotification
          messages={[
            "Hey There! I'm Jarvis, your helper assistant throughout tracking.so. ",
            "I see you haven't added any friends yet... statistically, you'll have **95%** more chances of success if you do, you know? Also, this timeline would get prettier 😅",
            "Here's a how you could do it:",
          ]}
          createdAt={new Date().toISOString()}
        />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AccountabilityStepCard
            icon={<UserPlus size={30} />}
            title="Invite a friend to the app"
            description="Share your invite link and both join the app free of cost."
            buttonText="Share Invite"
            onClick={handleShareReferralLink}
            secondaryText="Search for a friend"
            secondaryOnClick={onOpenSearch}
            color="blue"
          />
          <AccountabilityStepCard
            icon={<Search size={30} />}
            title="Find someone in our community"
            description="Find someone who will help you stay on track"
            buttonText="Open discord"
            onClick={() => {
              window.open("https://discord.gg/xMVb7YmQMQ", "_blank");
            }}
            color="blue"
          />
          <div>
            <AccountabilityStepCard
              icon={<ScanFace size={30} />}
              title="Use our AI coach"
              description="Get personalized suggestions and support from our AI coach"
              buttonText="Try free"
              onClick={() => setShowUpgradePopover(true)}
              color="gradient"
            />
          </div>
        </div>

      </>
      // <div className="text-left text-gray-500">
      //   You haven&apos;t added any friends yet 🙁
      //   <br />
      //   <span className="text-sm text-gray-500">
      //     By doing so, you&apos;ll{" "}
      //     <span className="font-bold">
      //       increase your chances of success by up to 95%
      //     </span>
      //   </span>
      //   <p className="text-sm text-gray-500 mt-4">
      //     <span className="underline cursor-pointer" onClick={onOpenSearch}>
      //       Search
      //     </span>{" "}
      //     for friends already using the app, or invite new ones by{" "}
      //     <span
      //       className="underline cursor-pointer"
      //       onClick={async () => {
      //         try {
      //           const link = `https://app.tracking.so/join/${userData?.user?.username}`;
      //           if (isShareSupported) {
      //             const success = await share(link);
      //             if (!success) throw new Error("Failed to share");
      //           } else {
      //             const success = await copyToClipboard(link);
      //             if (!success) throw new Error("Failed to copy");
      //             toast.success("Copied to clipboard");
      //           }
      //         } catch (error) {
      //           console.error("Failed to copy link to clipboard");
      //         }
      //       }}
      //     >
      //       sharing your profile link.
      //     </span>
      //   </p>
      // </div>
    );
  }

  const sortedEntries = [
    ...(timelineData.data?.recommendedActivityEntries || []),
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <h2 className="text-lg font-semibold mb-4">
        Friend&apos;s last activities
      </h2>

      {timelineData.isFetched &&
        timelineData.data?.recommendedActivities &&
        timelineData.data?.recommendedUsers &&
        sortedEntries.map((entry: TaggedActivityEntry) => {
          const activity: Activity | undefined =
            timelineData.data!.recommendedActivities!.find(
              (a: Activity) => a.id === entry.activity_id
            );
          const user: User | undefined =
            timelineData.data!.recommendedUsers!.find(
              (u: User) => u.id === activity?.user_id
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
