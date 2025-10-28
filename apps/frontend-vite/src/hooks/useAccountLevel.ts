import { useTheme } from "@/contexts/theme/useTheme";
import { Crown, Gem, Medal, Star, Target } from "lucide-react";
import React, { useMemo } from "react";
import { useUnifiedProfileData } from "./useUnifiedProfileData";

export const HABIT_BONUS_POINTS = 25;
export const LIFESTYLE_BONUS_POINTS = 100;

export type AccountLevel = {
  name: string;
  threshold: number;
  color: string;
  bgColor: string;
  getIcon: (props?: { size?: number; className?: string }) => JSX.Element;
};

const createLevel = (
  name: string,
  threshold: number,
  color: string,
  bgColor: string,
  IconComponent: React.ComponentType<any>,
  iconClassName: string
): AccountLevel => ({
  name,
  threshold,
  color,
  bgColor,
  getIcon: (props = {}) =>
    React.createElement(IconComponent, {
      size: props.size || 24,
      className: `${iconClassName} ${props.className || ""}`.trim(),
    }),
});

export const getAccountLevels = (isDarkMode: boolean): AccountLevel[] => [
  createLevel(
    "New",
    0,
    isDarkMode ? "#9CA3AF" : "#A3A3A3",
    isDarkMode ? "#6B7280" : "#787878",
    Target,
    "text-gray-400 dark:text-gray-500"
  ),
  createLevel(
    "Bronze",
    16,
    isDarkMode ? "#D97706" : "#CD7F32",
    isDarkMode ? "#78350f" : "#92400e",
    Medal,
    "text-amber-600 dark:text-amber-500"
  ),
  createLevel(
    "Silver",
    128,
    isDarkMode ? "#94A3B8" : "#A9BCD5",
    isDarkMode ? "#334155" : "#475569",
    Medal,
    "text-slate-400 dark:text-slate-300"
  ),
  createLevel(
    "Gold",
    512,
    isDarkMode ? "#FCD34D" : "#fbbf24",
    isDarkMode ? "#B45309" : "#d97706",
    Crown,
    "text-yellow-500 dark:text-yellow-400"
  ),
  createLevel(
    "Platinum",
    1024,
    isDarkMode ? "#94A3B8" : "#A8CADD",
    isDarkMode ? "#475569" : "#71717a",
    Star,
    "text-slate-300 dark:text-slate-400"
  ),
  createLevel(
    "Diamond",
    2048,
    isDarkMode ? "#06B6D4" : "#22d3ee",
    isDarkMode ? "#0E7490" : "#0891b2",
    Gem,
    "text-cyan-400 dark:text-cyan-300"
  ),
];

// Backwards compatibility - default to light mode
// For theme-aware usage, use getAccountLevels(isDarkMode) or useAccountLevel hook
export const ACCOUNT_LEVELS = getAccountLevels(false);

/**
 * Hook to calculate account level with bonus points from plans.
 * Automatically fetches user data and calculates bonuses.
 *
 * @param username - Optional username to get account level for. If not provided, uses current user.
 */
export function useAccountLevel(username?: string) {
  const { isDarkMode } = useTheme();
  const { profileData } = useUnifiedProfileData(username);

  return useMemo(() => {
    const ACCOUNT_LEVELS = getAccountLevels(isDarkMode);

    // Calculate total activities logged
    const totalActivitiesLogged = profileData?.activityEntries?.length || 0;

    // Calculate bonus points from plans
    const activePlans =
      profileData?.plans?.filter((plan) => !plan.deletedAt) || [];
    const habitCount = activePlans.filter(
      (plan) => plan.progress.habitAchievement.isAchieved
    ).length;
    const lifestyleCount = activePlans.filter(
      (plan) => plan.progress.lifestyleAchievement.isAchieved
    ).length;
    const habitBonus = habitCount * HABIT_BONUS_POINTS;
    const lifestyleBonus = lifestyleCount * LIFESTYLE_BONUS_POINTS;
    const bonusPoints = habitBonus + lifestyleBonus;

    const totalPoints = totalActivitiesLogged + bonusPoints;

    // Find current level
    let currentLevel: AccountLevel | null = null;
    let nextLevel: AccountLevel | null = null;

    for (let i = 0; i < ACCOUNT_LEVELS.length; i++) {
      const level = ACCOUNT_LEVELS[i];
      if (totalPoints >= level.threshold) {
        currentLevel = level;
      } else {
        nextLevel = level;
        break;
      }
    }

    // If no current level, user hasn't reached bronze yet
    if (!currentLevel) {
      nextLevel = ACCOUNT_LEVELS[0];
    }

    // Calculate percentage to next level
    let percentage = 0;
    let activitiesForNextLevel = 0;

    if (nextLevel) {
      const previousThreshold = currentLevel?.threshold || 0;
      const range = nextLevel.threshold - previousThreshold;
      const progress = totalPoints - previousThreshold;
      percentage = Math.min((progress / range) * 100, 100);
      activitiesForNextLevel = nextLevel.threshold - totalPoints;
    } else {
      // Max level reached
      percentage = 100;
      activitiesForNextLevel = 0;
    }

    return {
      totalActivitiesLogged,
      bonusPoints,
      totalPoints,
      habitCount,
      lifestyleCount,
      habitBonus,
      lifestyleBonus,
      currentLevel,
      nextLevel,
      percentage: Math.max(0, percentage),
      activitiesForNextLevel: Math.max(0, activitiesForNextLevel),
      isMaxLevel: !nextLevel,
      atLeastBronze: totalPoints >= ACCOUNT_LEVELS[1].threshold,
    };
  }, [profileData, isDarkMode]);
}
