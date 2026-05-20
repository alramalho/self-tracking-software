import type { SharedActivityCandidate } from "@/contexts/activities/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
  const name = candidate.user.name || `@${username}`;

  return (
    <AppleLikePopover open={open} onClose={onDismiss}>
      <div className="space-y-6 p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex items-center justify-center"
        >
          <span className="text-6xl">🤝</span>
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-bold text-center text-foreground"
        >
          Did you do this together?
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-center text-muted-foreground"
        >
          Looks like @{username} logged a similar{" "}
          {candidate.activity.emoji} {candidate.activity.title} on the same day.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border bg-card/60 overflow-hidden"
        >
          {candidate.imageUrls?.[0] && (
            <img
              src={candidate.imageUrls[0]}
              alt={`${username}'s activity`}
              className="w-full h-40 object-cover"
            />
          )}
          <div className="flex items-center gap-4 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={candidate.user.picture || ""} />
              <AvatarFallback>{username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-foreground">{name}</div>
              <div className="text-sm text-muted-foreground">
                {candidate.quantity} {candidate.activity.measure}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3 pt-2"
        >
          <Button
            className="flex-1"
            onClick={() => onConfirm(candidate.activityEntryId)}
          >
            Yes, link us
          </Button>
          <Button className="flex-1" variant="outline" onClick={onDismiss}>
            Not this time
          </Button>
        </motion.div>
      </div>
    </AppleLikePopover>
  );
}
