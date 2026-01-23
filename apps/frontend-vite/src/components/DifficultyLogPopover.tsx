import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import React, { useState } from "react";
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

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { value: "very_easy", label: "Very Easy", emoji: "😌" },
  { value: "easy", label: "Easy", emoji: "🙂" },
  { value: "moderate", label: "Moderate", emoji: "😐" },
  { value: "hard", label: "Hard", emoji: "😤" },
  { value: "very_hard", label: "Very Hard", emoji: "🥵" },
];

interface DifficultyLogPopoverProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (difficulty: DifficultyLevel) => Promise<void>;
  activityTitle?: string;
  activityEmoji?: string;
}

export const DifficultyLogPopover: React.FC<DifficultyLogPopoverProps> = ({
  open,
  onClose,
  onSubmit,
  activityTitle,
  activityEmoji,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedDifficulty) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedDifficulty);
      setSelectedDifficulty(null);
      onClose();
    } catch (error) {
      console.error("Failed to log difficulty:", error);
      toast.error("Failed to save difficulty. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSelectedDifficulty(null);
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
              <span className="font-medium text-foreground">{option.label}</span>
            </button>
          ))}
        </motion.div>

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
