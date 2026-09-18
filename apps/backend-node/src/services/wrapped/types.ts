import type { Prisma } from "@tsw/prisma";
export type WrappedDatabase = Pick<Prisma.TransactionClient, "user" | "plan" | "activityEntry">;
export interface YearPlanStats {
  id: string;
  peakStreak: number;
  habitEarned: boolean;
  lifestyleEarned: boolean;
}
export interface YearScore {
  id: string;
  username: string;
  name: string | null;
  picture: string | null;
  totalActivitiesLogged: number;
  habitCount: number;
  lifestyleCount: number;
  totalPoints: number;
  bestStreak: number;
}
export interface WrappedLeaderboard {
  year: number;
  timezone: "UTC";
  people: YearScore[];
  plans: YearPlanStats[];
}
export interface CachedWeek {
  startDate?: string;
  isCompleted?: boolean;
  plannedActivities?: number | { date: string; activityId: string }[];
  completedActivities?: { datetime: string; activityId?: string; deletedAt?: string | null }[];
}
export interface CachedProgress {
  weeks?: CachedWeek[];
  habitAchievement?: { achievedAt?: string | null };
  lifestyleAchievement?: { achievedAt?: string | null };
}
