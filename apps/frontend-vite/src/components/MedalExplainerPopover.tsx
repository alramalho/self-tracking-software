import AppleLikePopover from "@/components/AppleLikePopover";
import { ProgressBar } from "@/components/ProgressBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/theme/useTheme";
import {
  getAccountLevels,
  useAccountLevel,
  HABIT_BONUS_POINTS,
  LIFESTYLE_BONUS_POINTS,
} from "@/hooks/useAccountLevel";
import { useUnifiedProfileData } from "@/hooks/useUnifiedProfileData";
import {
  Check,
  Medal,
  Target,
  Trophy,
  Zap,
  Sprout,
  Rocket,
} from "lucide-react";
import { motion } from "motion/react";
import React, { useState, useEffect } from "react";

interface MedalExplainerPopoverProps {
  open: boolean;
  onClose: () => void;
  username?: string; // Optional: if provided, shows that user's level instead of current user
}

const MedalExplainerPopover: React.FC<MedalExplainerPopoverProps> = ({
  open,
  onClose,
  username,
}) => {
  const { isDarkMode } = useTheme();
  const accountLevel = useAccountLevel(username);
  const ACCOUNT_LEVELS = getAccountLevels(isDarkMode);

  // Get profile data for displaying user info (name, picture, etc.)
  const { profileData } = useUnifiedProfileData(username);

  // Animation state - trigger animations when popover opens
  const [showBaseProgress, setShowBaseProgress] = useState(false);
  const [showHabitBonus, setShowHabitBonus] = useState(false);
  const [showLifestyleBonus, setShowLifestyleBonus] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset animation state
      setShowBaseProgress(false);
      setShowHabitBonus(false);
      setShowLifestyleBonus(false);

      // Trigger animations in sequence
      const timer1 = setTimeout(() => setShowBaseProgress(true), 100);
      const timer2 = setTimeout(() => setShowHabitBonus(true), 600);
      const timer3 = setTimeout(() => setShowLifestyleBonus(true), 1100);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [open]);

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Level Progress">
      <div className="p-6 space-y-6">
        {/* User Profile Header */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src={profileData?.picture || ""}
                alt={profileData?.name || ""}
              />
              <AvatarFallback className="bg-muted">
                {profileData?.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            {accountLevel.currentLevel && accountLevel.atLeastBronze && (
              <div className="absolute -bottom-1 -right-1">
                <Medal size={20} className="text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {profileData?.name}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span
                className="font-medium text-foreground"
                style={{ color: accountLevel.currentLevel?.color }}
              >
                {accountLevel.currentLevel?.name || "New"}
              </span>
              <span>•</span>
              <span>{accountLevel.totalPoints} points</span>
            </div>
            <span className="text-xs text-muted-foreground/60 ml-1">
              ({accountLevel.totalActivitiesLogged} from activities)
            </span>
            {accountLevel.bonusPoints > 0 && (
              <span className="text-xs text-green-600 ml-1">
                (+{accountLevel.bonusPoints} bonus)
              </span>
            )}
          </div>
        </div>

        {/* Current Progress */}
        {!accountLevel.isMaxLevel && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-sm">
                <span className="text-muted-foreground">Next: </span>
                <span
                  className="font-medium text-foreground"
                  style={{ color: accountLevel.nextLevel?.color }}
                >
                  {accountLevel.nextLevel?.name}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs bg-background py-1">
                {Math.round(accountLevel.percentage)}%
              </Badge>
            </div>

            {/* Progress Breakdown */}
            <ProgressBar
              current={
                accountLevel.totalPoints -
                (accountLevel.currentLevel?.threshold || 0)
              }
              max={accountLevel.nextLevel?.threshold || 0}
              className="h-2 bg-card"
              color={accountLevel.nextLevel?.color}
            />

            {/* Summary */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Total:{" "}
                <span className="font-medium text-foreground">
                  {accountLevel.totalPoints} points
                </span>{" "}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 opacity-59 justify-center">
              <div className="flex items-center gap-1">
                <Target size={16} className="text-gray-500" />
                <span className="text-xs text-gray-500"> activity</span>
                <span className="text-xs text-muted-foreground">
                  worth 1 point
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Sprout size={16} className="text-lime-500" />
                <span className="text-xs text-lime-500"> habit</span>
                <span className="text-xs text-muted-foreground">
                  worth 25 bonus points
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Rocket size={16} className="text-orange-500" />
                <span className="text-xs text-orange-500"> lifestyle</span>
                <span className="text-xs text-muted-foreground">
                  worth 100 bonus points
                </span>
              </div>
            </div>
          </div>
        )}

        {accountLevel.isMaxLevel && (
          <div className="text-center space-y-2 py-4">
            <Trophy size={24} className="text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="font-medium text-foreground">Max Level Reached</h3>
              <p className="text-xs text-muted-foreground">
                You&apos;ve unlocked all available levels
              </p>
            </div>
          </div>
        )}

        {/* Level Journey */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Target size={16} className="text-muted-foreground" />
            All Levels
          </h3>

          <div className="space-y-2">
            {ACCOUNT_LEVELS.map((level) => {
              const isUnlocked = accountLevel.totalPoints >= level.threshold;
              const isCurrent = accountLevel.currentLevel?.name === level.name;

              return (
                <div
                  key={level.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? "border-border bg-background/50"
                      : isUnlocked
                      ? "border-border/50 bg-background"
                      : "border-border/30 bg-muted/20 opacity-60"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                    <div className="w-4 h-4 text-muted-foreground">
                      {level.getIcon()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isUnlocked
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {level.name}
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs h-5">
                          Current
                        </Badge>
                      )}
                      {isUnlocked && !isCurrent && (
                        <Check size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {level.threshold === 0
                        ? "Starting level"
                        : `${level.threshold} points required`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivational Message */}
        <div className="flex flex-row gap-3 items-center text-center py-4 border-t border-border">
          <Zap size={34} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-left text-muted-foreground">
            Keep logging activities and create plans to unlock new levels!
          </p>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export default MedalExplainerPopover;
