import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCircleFeed } from "../api";
import type { CircleFeedEntry, CircleFeedListProps, PhotoCardProps } from "../types";

// The feed returns a slim entry; the timeline card reads the same fields it needs.
const asCardProps = (entry: CircleFeedEntry) => ({
  activity: entry.activity as unknown as PhotoCardProps["activity"],
  activityEntry: entry as unknown as PhotoCardProps["activityEntry"],
  user: entry.user as unknown as PhotoCardProps["user"],
});

// "Latest": circle members' sessions on their circle plans, newest first.
export function CircleFeedList({ circleId }: CircleFeedListProps) {
  const navigate = useNavigate();
  const feed = useCircleFeed(circleId);
  const introIds = new Set(feed.data?.introIds ?? []);
  const entries = (feed.data?.entries ?? []).filter((entry) => entry.activity);
  const openProfile = (username?: string | null) => {
    if (username) navigate({ to: "/profile/$username", params: { username } });
  };

  if (feed.isLoading)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (feed.error)
    return (
      <p className="text-sm text-red-500">
        Couldn't load the latest sessions.{" "}
        <button type="button" className="underline" onClick={() => void feed.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!entries.length)
    return <p className="py-4 text-sm text-muted-foreground">No sessions yet. Yours could be the first.</p>;

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-1.5">
          {introIds.has(entry.id) && <p className="text-[13px] text-muted-foreground">👋 Intro</p>}
          <ActivityEntryPhotoCard
            {...asCardProps(entry)}
            userPlansProgressData={[]}
            weekChip={entry.weekChip}
            onAvatarClick={() => openProfile(entry.user.username)}
            onUsernameClick={() => openProfile(entry.user.username)}
            onParticipantClick={openProfile}
          />
        </div>
      ))}
    </div>
  );
}
