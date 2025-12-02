import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getAccountLevels } from "@/hooks/useAccountLevel";
import { useTheme } from "@/contexts/theme/useTheme";
import { getThemeVariants } from "@/utils/theme";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import React from "react";

export type AchievementType = "streak" | "habit" | "lifestyle" | "level_up";

interface AchievementCelebrationPopoverProps {
  open: boolean;
  onClose: () => void;
  onShare?: () => void;
  achievementType: AchievementType;
  planEmoji: string;
  planGoal: string;
  streakNumber?: number; // For streak type
  levelName?: string; // For level_up type
  isLoading?: boolean;
}

const getAchievementText = (
  type: AchievementType,
  streakNumber?: number,
  levelName?: string
): {
  title: string;
  subtitle: string;
  fireEmojis: string[];
} => {
  switch (type) {
    case "streak":
      return {
        title: `${streakNumber} Week Streak!`,
        subtitle: "Keep it up!",
        fireEmojis: ["🔥", "🔥"],
      };
    case "habit":
      return {
        title: "Habit Formed!",
        subtitle: "Congratulations! You're 4 weeks strong",
        fireEmojis: ["⭐", "⭐"],
      };
    case "lifestyle":
      return {
        title: "Lifestyle!",
        subtitle: "Wow! Less than 1% achieved this! Congratulations on your 9 weeks strong!",
        fireEmojis: ["🏆", "🏆"],
      };
    case "level_up":
      return {
        title: `${levelName}!`,
        subtitle: `You've reached ${levelName} level!`,
        fireEmojis: ["🎖️", "🎖️"],
      };
  }
};

export const AchievementCelebrationPopover: React.FC<
  AchievementCelebrationPopoverProps
> = ({ open, onClose, onShare, achievementType, planEmoji, planGoal, streakNumber, levelName, isLoading = false }) => {
  const themeColors = useThemeColors();
  const { isDarkMode } = useTheme();
  const variants = getThemeVariants(themeColors.raw);
  const details = getAchievementText(achievementType, streakNumber, levelName);

  // Get the level icon for level_up achievements
  const levelIcon = React.useMemo(() => {
    if (achievementType !== "level_up" || !levelName) return null;
    const levels = getAccountLevels(isDarkMode);
    const level = levels.find(l => l.name === levelName);
    return level?.getIcon({ size: 80 });
  }, [achievementType, levelName, isDarkMode]);

  return (
    <AppleLikePopover
      onClose={onClose}
      open={open}
      title=""
      displayIcon={false}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative p-8 pb-6"
      >
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-4 left-4 z-20">
            <Loader2 size={20} className="text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted/50 transition-colors z-20 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Dismiss"
        >
          <X size={20} className="text-muted-foreground" />
        </button>

        {/* Confetti Effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -20, x: Math.random() * 400, opacity: 1 }}
              animate={{
                y: 500,
                x: Math.random() * 400 - 50,
                opacity: 0,
                rotate: Math.random() * 720,
              }}
              transition={{
                duration: 2 + Math.random() * 1.5,
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
              className="absolute text-2xl"
              style={{ left: `${(i / 12) * 100}%` }}
            >
              {["🎉", "✨", "🌟", "⭐", "🎊", "💫"][i % 6]}
            </motion.div>
          ))}
        </motion.div>

        {/* Main celebration content */}
        <div className="text-center relative">
          {/* Emoji with fire side-by-side */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.1,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="flex items-center justify-center gap-4 mb-6"
          >
            {/* Left fire */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 100,
                damping: 10,
              }}
              className="text-5xl"
            >
              {details.fireEmojis[0]}
            </motion.div>

            {/* Main Plan Emoji or Level Icon */}
            <div className="flex items-center justify-center text-8xl">
              {levelIcon || planEmoji}
            </div>

            {/* Right fire */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 100,
                damping: 10,
              }}
              className="text-5xl"
            >
              {details.fireEmojis[1]}
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold text-foreground mb-1"
          >
            {details.title}
          </motion.h3>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-lg text-muted-foreground mb-1"
          >
            {details.subtitle}
          </motion.p>

          {/* Plan goal - hide for level_up since subtitle already contains the info */}
          {achievementType !== "level_up" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-sm text-muted-foreground/70 mb-6"
            >
              {planGoal}
            </motion.p>
          )}
          {achievementType === "level_up" && <div className="mb-6" />}

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="space-y-2"
          >
            {onShare && (
              <Button
                onClick={onShare}
                disabled={isLoading}
                className={`w-full ${variants.button.solid} font-semibold`}
              >
                Share with Connections 🎉
              </Button>
            )}
            <Button
              onClick={onClose}
              disabled={isLoading}
              variant={onShare ? "ghost" : "default"}
              className={onShare ? "w-full" : `w-full ${variants.button.solid} font-semibold`}
            >
              {onShare ? "Skip this one" : "Awesome!"}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </AppleLikePopover>
  );
};
