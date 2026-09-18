import type { DateValue, User } from "@/core/types";
export const accountLevels = [
  { name: "New", threshold: 0, light: "#A3A3A3", dark: "#9CA3AF" },
  { name: "Bronze", threshold: 16, light: "#CD7F32", dark: "#D97706" },
  { name: "Silver", threshold: 128, light: "#A9BCD5", dark: "#94A3B8" },
  { name: "Gold", threshold: 512, light: "#fbbf24", dark: "#FCD34D" },
  { name: "Platinum", threshold: 1024, light: "#A8CADD", dark: "#94A3B8" },
  { name: "Diamond", threshold: 2048, light: "#22d3ee", dark: "#06B6D4" },
];
export function profileStats(user: User) {
  const plans = (user.plans ?? []).filter((p) => !p.deletedAt);
  const stats = user.accountStats;
  const activities =
    stats?.totalActivitiesLogged ??
    user.activityEntries?.filter((e) => !e.deletedAt).length ??
    0;
  const habits =
    stats?.habitCount ??
    plans.filter((p) => p.progress?.habitAchievement?.isAchieved).length;
  const lifestyles =
    stats?.lifestyleCount ??
    plans.filter((p) => p.progress?.lifestyleAchievement?.isAchieved).length;
  const habitBonus = stats?.habitBonus ?? habits * 25;
  const lifestyleBonus = stats?.lifestyleBonus ?? lifestyles * 100;
  const bonusPoints = stats?.bonusPoints ?? habitBonus + lifestyleBonus;
  const points =
    stats?.totalPoints ?? activities + bonusPoints;
  const level =
    accountLevels.findLast((l) => l.threshold <= points) ?? accountLevels[0];
  const next = accountLevels.find((l) => l.threshold > points);
  const percentage = next
    ? Math.max(
        0,
        Math.min(
          100,
          ((points - level.threshold) / (next.threshold - level.threshold)) *
            100,
        ),
      )
    : 100;
  return {
    activities,
    habits,
    lifestyles,
    habitBonus,
    lifestyleBonus,
    bonusPoints,
    points,
    level,
    next,
    percentage,
    streaks: plans.reduce(
      (sum, p) => sum + (p.progress?.achievement?.streak ?? 0),
      0,
    ),
  };
}
export function friendsOf(user: User) {
  const people = [
    ...(user.connectionsFrom ?? [])
      .filter((c) => c.status === "ACCEPTED")
      .map((c) => c.to),
    ...(user.connectionsTo ?? [])
      .filter((c) => c.status === "ACCEPTED")
      .map((c) => c.from),
  ].filter(Boolean);
  return [...new Map(people.map((p) => [p.id, p])).values()].sort((a, b) => {
    const activityDifference = activityCount(b) - activityCount(a);
    if (activityDifference !== 0) return activityDifference;
    const lastActivityDifference = activityTimestamp(b.lastActiveAt) - activityTimestamp(a.lastActiveAt);
    if (lastActivityDifference !== 0) return lastActivityDifference;
    return (a.name ?? a.username ?? "").localeCompare(b.name ?? b.username ?? "");
  });
}

function activityCount(user: User) {
  return user._count?.activityEntries ?? 0;
}

function activityTimestamp(value?: DateValue | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
