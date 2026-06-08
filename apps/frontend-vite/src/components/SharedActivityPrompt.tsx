import type { SharedActivityCandidate } from "@/contexts/activities/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import AppleLikePopover from "./AppleLikePopover";

interface SharedActivityPromptProps {
  open: boolean;
  candidates: SharedActivityCandidate[];
  onConfirm: (candidateActivityEntryIds: string[]) => Promise<void>;
  onDismiss: () => void;
}

export default function SharedActivityPrompt({
  open,
  candidates,
  onConfirm,
  onDismiss,
}: SharedActivityPromptProps) {
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleCandidates = useMemo(() => candidates, [candidates]);

  useEffect(() => {
    if (!open) return;
    setSelectedCandidateIds(
      visibleCandidates.map((candidate) => candidate.activityEntryId)
    );
  }, [open, visibleCandidates]);

  if (!visibleCandidates.length) return null;

  const selectedCount = selectedCandidateIds.length;
  const primaryCandidate = visibleCandidates[0];
  const primaryUsername = primaryCandidate.user.username || "your friend";

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    );
  };

  const handleConfirm = async () => {
    if (selectedCandidateIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedCandidateIds);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          Looks like @{primaryUsername}
          {visibleCandidates.length > 1 ? " and others" : ""} logged a similar{" "}
          {primaryCandidate.activity.emoji} {primaryCandidate.activity.title} on
          the same day.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-h-[360px] space-y-2 overflow-y-auto pr-1"
        >
          {visibleCandidates.map((candidate) => {
            const username = candidate.user.username || "friend";
            const name = candidate.user.name || `@${username}`;
            const isSelected = selectedCandidateIds.includes(
              candidate.activityEntryId
            );

            return (
              <button
                key={candidate.activityEntryId}
                type="button"
                onClick={() => toggleCandidate(candidate.activityEntryId)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card/60 hover:bg-accent/50"
                }`}
              >
                <Avatar className="h-11 w-11 flex-shrink-0">
                  <AvatarImage src={candidate.user.picture || ""} />
                  <AvatarFallback>{username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground">
                    {name}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {candidate.activity.emoji} {candidate.quantity}{" "}
                    {candidate.activity.measure}
                  </div>
                </div>
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 text-transparent"
                  }`}
                >
                  ✓
                </div>
              </button>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3 pt-2"
        >
          <Button
            className="flex-1"
            disabled={selectedCount === 0 || isSubmitting}
            onClick={handleConfirm}
          >
            {selectedCount > 1
              ? `Link ${selectedCount} people`
              : "Yes, link us"}
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={isSubmitting}
            onClick={onDismiss}
          >
            Not this time
          </Button>
        </motion.div>
      </div>
    </AppleLikePopover>
  );
}
