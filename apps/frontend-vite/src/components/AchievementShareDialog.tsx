import AppleLikePopover from "@/components/AppleLikePopover";
import MultiPhotoUploader from "@/components/ui/MultiPhotoUploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAchievements } from "@/contexts/achievements";
import { getAccountLevels } from "@/hooks/useAccountLevel";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useTheme } from "@/contexts/theme/useTheme";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { type AchievementType } from "./AchievementCelebrationPopover";

interface AchievementShareDialogProps {
  open: boolean;
  onClose: () => void;
  planId?: string;
  planEmoji: string;
  planGoal: string;
  achievementType: AchievementType;
  streakNumber?: number;
  levelName?: string;
}

export const AchievementShareDialog: React.FC<
  AchievementShareDialogProps
> = ({
  open,
  onClose,
  planId,
  planEmoji,
  planGoal,
  achievementType,
  streakNumber,
  levelName,
}) => {
  const themeColors = useThemeColors();
  const { isDarkMode } = useTheme();
  const variants = getThemeVariants(themeColors.raw);
  const { createAchievementPost, isCreatingAchievementPost } = useAchievements();
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const isLevelUp = achievementType === "level_up";

  // Get the level icon for level_up achievements
  const levelIcon = useMemo(() => {
    if (!isLevelUp || !levelName) return null;
    const levels = getAccountLevels(isDarkMode);
    const level = levels.find(l => l.name === levelName);
    return level?.getIcon({ size: 64 });
  }, [isLevelUp, levelName, isDarkMode]);

  const getAchievementTitle = () => {
    switch (achievementType) {
      case "streak":
        return `${streakNumber} Week Streak!`;
      case "habit":
        return "Habit Formed!";
      case "lifestyle":
        return "Lifestyle Achievement!";
      case "level_up":
        return `Reached ${levelName}!`;
    }
  };

  const handleShare = async () => {
    try {
      await createAchievementPost({
        planId,
        achievementType,
        streakNumber,
        levelName,
        message,
        photos,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the context mutation
      console.error("Error sharing achievement:", error);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AppleLikePopover
      onClose={onClose}
      open={open}
      title="Share Achievement"
      displayIcon={false}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative p-6 pb-4"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center text-6xl mb-3">
            {levelIcon || planEmoji}
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">
            {getAchievementTitle()}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isLevelUp ? "New account level unlocked!" : planGoal}
          </p>
        </div>

        {/* Share prompt */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Share your achievement with your connections
            </label>
            <Textarea
              placeholder="Add a message about your achievement (optional)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isCreatingAchievementPost}
            />
          </div>

          {/* Photo uploader */}
          <div>
            <MultiPhotoUploader
              onFilesChange={setPhotos}
              maxFiles={10}
              disabled={isCreatingAchievementPost}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleShare}
            className={`w-full ${variants.button.solid} font-semibold`}
            disabled={isCreatingAchievementPost}
          >
            {isCreatingAchievementPost ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              "Share Achievement"
            )}
          </Button>
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
            disabled={isCreatingAchievementPost}
          >
            Skip for now
          </Button>
        </div>
      </motion.div>
    </AppleLikePopover>
  );
};
