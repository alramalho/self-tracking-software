import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApiWithAuth } from "@/api";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

export type DifficultyLevel =
  | "very_easy"
  | "easy"
  | "moderate"
  | "hard"
  | "very_hard";

interface DifficultyOption {
  value: DifficultyLevel;
  label: string;
  emoji: string;
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: "very_easy", label: "Very Easy", emoji: "😌" },
  { value: "easy", label: "Easy", emoji: "🙂" },
  { value: "moderate", label: "Moderate", emoji: "😐" },
  { value: "hard", label: "Hard", emoji: "😤" },
  { value: "very_hard", label: "Very Hard", emoji: "🥵" },
];

interface DifficultyLogPopoverProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    difficulty: DifficultyLevel,
    privateNotes?: string
  ) => Promise<void>;
  activityEntryId?: string | null;
  activityTitle?: string;
  activityEmoji?: string;
}

export const DifficultyLogPopover: React.FC<DifficultyLogPopoverProps> = ({
  open,
  onClose,
  onSubmit,
  activityEntryId,
  activityTitle,
  activityEmoji,
}) => {
  const api = useApiWithAuth();
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [reflectionReasons, setReflectionReasons] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [reflection, setReflection] = useState("");
  const [showReflectionDetail, setShowReflectionDetail] = useState(false);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedDifficulty(null);
      setReflectionReasons([]);
      setSelectedReasons([]);
      setReflection("");
      setShowReflectionDetail(false);
      setIsLoadingReasons(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !activityEntryId || !selectedDifficulty) {
      setReflectionReasons([]);
      setSelectedReasons([]);
      setIsLoadingReasons(false);
      return;
    }

    let cancelled = false;
    setIsLoadingReasons(true);
    setSelectedReasons([]);

    api
      .post<{ reasons: string[] }>(
        `/activities/activity-entries/${activityEntryId}/reflection-reasons`,
        { difficulty: selectedDifficulty }
      )
      .then((response) => {
        if (cancelled) return;
        setReflectionReasons(response.data.reasons);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load reflection reasons:", error);
        setReflectionReasons([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReasons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityEntryId, api, open, selectedDifficulty]);

  const shouldPromptReflection =
    selectedDifficulty === "hard" || selectedDifficulty === "very_hard";
  const shouldShowReflection = shouldPromptReflection || showReflectionDetail;

  const privateNotes = useMemo(() => {
    const parts = [
      selectedReasons.length
        ? `Coach should know: ${selectedReasons.join(", ")}.`
        : "",
      reflection.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : undefined;
  }, [reflection, selectedReasons]);

  const toggleReason = (reason: string) => {
    setSelectedReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    );
  };

  const handleSubmit = async () => {
    if (!selectedDifficulty) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedDifficulty, privateNotes);
      onClose();
    } catch (error) {
      console.error("Failed to log difficulty:", error);
      toast.error("Failed to save difficulty. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AppleLikePopover open={open} onClose={handleSkip}>
      <div className="space-y-6 p-6">
        {/* Activity Icon */}
        {activityEmoji && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex items-center justify-center mb-4 mx-auto"
          >
            <span className="text-6xl">{activityEmoji}</span>
          </motion.div>
        )}

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-bold text-center text-foreground mb-2"
        >
          How hard was {activityTitle || "this activity"}?
        </motion.h3>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-center text-muted-foreground mb-4"
        >
          This helps track your perceived effort over time.
        </motion.p>

        {/* Difficulty Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-2"
        >
          {DIFFICULTY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedDifficulty(option.value)}
              disabled={isSubmitting}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                "hover:bg-accent/50",
                selectedDifficulty === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              )}
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-medium text-foreground">
                {option.label}
              </span>
            </button>
          ))}
        </motion.div>

        {selectedDifficulty && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {shouldShowReflection ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    What should your coach know?
                  </p>
                  {isLoadingReasons ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading options...
                    </div>
                  ) : reflectionReasons.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {reflectionReasons.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => toggleReason(reason)}
                          disabled={isSubmitting}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selectedReasons.includes(reason)
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {showReflectionDetail ? (
                  <Textarea
                    value={reflection}
                    onChange={(event) => setReflection(event.target.value)}
                    placeholder="Add a private reflection..."
                    className="min-h-[84px] resize-none"
                    disabled={isSubmitting}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-muted-foreground"
                    onClick={() => setShowReflectionDetail(true)}
                    disabled={isSubmitting}
                  >
                    Add detail
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Reflection is private to you and your coach.
                </p>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 text-muted-foreground"
                onClick={() => setShowReflectionDetail(true)}
                disabled={isSubmitting}
              >
                Add reflection
              </Button>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-2 justify-end pt-4"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedDifficulty}
            size="sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Done"
            )}
          </Button>
        </motion.div>
      </div>
    </AppleLikePopover>
  );
};
