import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useCircleActions, useInvitableFriends } from "./api";
import { PersonAvatar } from "./components";
import type { InviteSheetProps } from "./types";

// Invite friends without leaving the app: each gets one notification that opens the
// circle's join screen. The link is still there for people who aren't on the app yet.
export function InviteSheet({ circleId, open, onClose, onShareLink }: InviteSheetProps) {
  const [search, setSearch] = useState("");
  const friends = useInvitableFriends(circleId, open);
  const { inviteFriend } = useCircleActions();
  const hasFriends = !!friends.data?.length;
  const query = search.trim().toLowerCase();
  const shown = (friends.data ?? []).filter(
    (friend) => !query || `${friend.name ?? ""} ${friend.username ?? ""}`.toLowerCase().includes(query)
  );
  // The next visit starts clean: no old search, no old error.
  const close = () => {
    setSearch("");
    inviteFriend.reset();
    onClose();
  };
  return (
    <AppleLikePopover open={open} onClose={close} title="Invite to circle">
      <div data-testid="invite-sheet" className="flex flex-col gap-3 pt-2">
        <h2 className="pr-10 text-xl font-bold text-foreground">Invite to circle</h2>
        {hasFriends && (
          <Input
            aria-label="Search friends"
            placeholder="Search friends"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        {friends.isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {friends.error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground">{toApiErrorMessage(friends.error, "Couldn't load your friends.")}</p>
            <Button variant="outline" onClick={() => void friends.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {friends.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No friends here yet. Share the link instead.</p>
        )}
        {hasFriends && !shown.length && <p className="text-sm text-muted-foreground">No friends found.</p>}
        {shown.length > 0 && (
          <div className="flex max-h-[45dvh] flex-col overflow-y-auto">
            {shown.map((friend) => {
              const name = friend.name ?? friend.username ?? "Someone";
              return (
                <div key={friend.userId} className="flex items-center gap-3 py-1.5">
                  <PersonAvatar name={name} picture={friend.picture} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-foreground">{name}</p>
                    {friend.username && (
                      <p className="truncate text-[13px] text-muted-foreground">@{friend.username}</p>
                    )}
                  </div>
                  {friend.state === "open" ? (
                    <Button
                      size="sm"
                      aria-label={`Invite ${name}`}
                      disabled={inviteFriend.isPending}
                      onClick={() => inviteFriend.mutate({ circleId, userId: friend.userId })}
                    >
                      Invite
                    </Button>
                  ) : (
                    <span className="text-[15px] text-muted-foreground">
                      {friend.state === "member" ? "In the circle" : "Invited"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {inviteFriend.error && (
          <p role="alert" className="text-sm text-red-500">
            {toApiErrorMessage(inviteFriend.error, "Couldn't send the invite. Please try again.")}
          </p>
        )}
        <Button variant="outline" className="h-12 w-full" onClick={onShareLink}>
          Share a link
        </Button>
      </div>
    </AppleLikePopover>
  );
}
