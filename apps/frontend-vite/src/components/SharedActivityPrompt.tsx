import type { SharedActivityCandidate } from "@/contexts/activities/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "./AppleLikePopover";

interface SharedActivityPromptProps {
  open: boolean;
  candidates: SharedActivityCandidate[];
  onConfirm: (candidateActivityEntryId: string) => Promise<void>;
  onDismiss: () => void;
}

export default function SharedActivityPrompt({
  open,
  candidates,
  onConfirm,
  onDismiss,
}: SharedActivityPromptProps) {
  const candidate = candidates[0];

  if (!candidate) return null;

  const username = candidate.user.username || "your friend";

  return (
    <AppleLikePopover open={open} onClose={onDismiss}>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Did you do this together?</h2>
          <p className="text-muted-foreground mt-2">
            Looks like @{username} logged a similar {candidate.activity.emoji}{" "}
            {candidate.activity.title} around the same time.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border bg-card/60 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={candidate.user.picture || ""} />
            <AvatarFallback>{username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">@{username}</div>
            <div className="text-sm text-muted-foreground">
              {candidate.quantity} {candidate.activity.measure} · score {candidate.score}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => onConfirm(candidate.activityEntryId)}
          >
            Yes, link us
          </Button>
          <Button className="flex-1" variant="outline" onClick={onDismiss}>
            Not this time
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
}
