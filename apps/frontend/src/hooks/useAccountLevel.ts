import { useActivities } from "@/contexts/activities";
import { Crown, Gem, Medal, Star, Target } from "lucide-react";
import React, { useMemo } from "react";

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

export const ACCOUNT_LEVELS: AccountLevel[] = [
  createLevel("New", 0, "#A3A3A3", "#787878", Target, "text-gray-400"),
  createLevel("Bronze", 16, "#CD7F32", "#92400e", Medal, "text-amber-600"),
  createLevel("Silver", 128, "#A9BCD5", "#475569", Medal, "text-slate-400"),
  createLevel("Gold", 512, "#fbbf24", "#d97706", Crown, "text-yellow-500"),
  createLevel("Platinum", 2048, "#A8CADD", "#71717a", Star, "text-slate-300"),
  createLevel("Diamond", 8192, "#22d3ee", "#0891b2", Gem, "text-cyan-400"),
];

export function useAccountLevel(totalActivitiesLoggedInput?: number) {
  const { activityEntries } = useActivities();
  const totalActivitiesLogged =
    totalActivitiesLoggedInput || activityEntries?.length || 0;
  return useMemo(() => {
    // Find current level
    let currentLevel: AccountLevel | null = null;
    let nextLevel: AccountLevel | null = null;

    for (let i = 0; i < ACCOUNT_LEVELS.length; i++) {
      const level = ACCOUNT_LEVELS[i];
      if (totalActivitiesLogged >= level.threshold) {
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
      const progress = totalActivitiesLogged - previousThreshold;
      percentage = Math.min((progress / range) * 100, 100);
      activitiesForNextLevel = nextLevel.threshold - totalActivitiesLogged;
    } else {
      // Max level reached
      percentage = 100;
      activitiesForNextLevel = 0;
    }

    return {
      totalActivitiesLogged,
      currentLevel,
      nextLevel,
      percentage: Math.max(0, percentage),
      activitiesForNextLevel: Math.max(0, activitiesForNextLevel),
      isMaxLevel: !nextLevel,
      atLeastBronze: totalActivitiesLogged >= ACCOUNT_LEVELS[1].threshold,
    };
  }, [totalActivitiesLogged]);
}
