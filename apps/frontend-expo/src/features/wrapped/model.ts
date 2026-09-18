import {
  differenceInCalendarDays,
  eachDayOfInterval,
  startOfDay,
} from "date-fns";
import type {
  Activity,
  ActivityEntry,
  MetricEntry,
  Plan,
} from "@/core/types";
import type {
  ActivityTotal,
  CountryCount,
  JourneyData,
  MoodPeriod,
  StoryId,
  WrappedData,
  YearPlanStats,
} from "./types";
import { timezoneToCountryCode, getCountryName } from "./timezoneToCountry";
export const WRAPPED_YEAR = 2025; // Same retrospective as the PWA, not the current year.
export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const yearEntries = (entries: ActivityEntry[], year: number) =>
  entries.filter(
    (e) => !e.deletedAt && new Date(e.datetime).getUTCFullYear() === year,
  );
export const yearMetrics = (entries: MetricEntry[], year: number) =>
  entries.filter(
    (e) =>
      !e.skipped &&
      Number.isFinite(e.rating) &&
      new Date(e.createdAt).getUTCFullYear() === year,
  );
export const photoUrl = (entry: ActivityEntry) =>
  entry.imageUrl ||
  entry.imageUrls?.[0] ||
  (entry.imageS3Path
    ? `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`
    : undefined);
export const flag = (code: string) =>
  String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 127397 + c.charCodeAt(0)),
  );
export function activityTotals(
  entries: ActivityEntry[],
  activities: Activity[],
): ActivityTotal[] {
  return activities
    .map((activity) => {
      const logs = entries.filter((e) => e.activityId === activity.id);
      return {
        activity,
        count: logs.length,
        days: new Set(
          logs.map((e) => new Date(e.datetime).toISOString().slice(0, 10)),
        ).size,
        quantity: logs.reduce((s, e) => s + e.quantity, 0),
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.days - a.days);
}
export function countries(entries: ActivityEntry[]): CountryCount[] {
  const counts = new Map<string, number>();
  entries.forEach((e) => {
    const code = timezoneToCountryCode(e.timezone);
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  });
  return [...counts]
    .map(([code, count]) => ({ code, count, name: getCountryName(code) }))
    .sort((a, b) => b.count - a.count);
}
export const peakStreak = (plan: Plan, annualPlans: YearPlanStats[]) =>
  annualPlans.find(p => p.id === plan.id)?.peakStreak ?? 0;
export const tier = (plan: Plan, annualPlans: YearPlanStats[]) => {
  const stats = annualPlans.find(p => p.id === plan.id);
  return stats?.lifestyleEarned ? "lifestyle" : stats?.habitEarned ? "habit" : "none";
};
export function rankedPlans(plans: Plan[], annualPlans: YearPlanStats[]) {
  const order = { lifestyle: 0, habit: 1, none: 2 };
  return plans.filter(p => !p.deletedAt && (peakStreak(p, annualPlans) > 0 || tier(p, annualPlans) !== "none"))
    .sort((a,b) => order[tier(a, annualPlans)] - order[tier(b, annualPlans)] || peakStreak(b, annualPlans) - peakStreak(a, annualPlans));
}
export function moodStats(entries: MetricEntry[]) {
  const average = entries.length
    ? entries.reduce((s, e) => s + e.rating, 0) / entries.length
    : 0;
  const periods = (
    labels: string[],
    index: (date: Date) => number,
  ): MoodPeriod[] =>
    labels.map((label, i) => {
      const values = entries.filter((e) => index(new Date(e.createdAt)) === i);
      const avg = values.length
        ? values.reduce((s, e) => s + e.rating, 0) / values.length
        : 0;
      return {
        label,
        index: i,
        count: values.length,
        average: avg,
        percentDiff: average ? ((avg - average) / average) * 100 : 0,
      };
    });
  const month = periods(months, (d) => d.getMonth()),
    day = periods(weekdays, (d) => d.getDay());
  const significant = (p: MoodPeriod[]) =>
    p.filter((v) => v.count >= 3).sort((a, b) => b.average - a.average);
  return {
    average,
    min: entries.length ? Math.min(...entries.map((e) => e.rating)) : 0,
    max: entries.length ? Math.max(...entries.map((e) => e.rating)) : 0,
    month,
    day,
    bestMonth: significant(month)[0],
    worstMonth: significant(month).at(-1),
    bestDay: significant(day)[0],
    worstDay: significant(day).at(-1),
  };
}
export function storiesFor(data: WrappedData): StoryId[] {
  const self = data.self;
  return [
    "hero",
    "world",
    "journey",
    ...(rankedPlans(data.plans, data.annualPlans).length ? ["plans" as const] : []),
    "mood",
    ...(activityTotals(yearEntries(data.entries, data.year), data.activities)
      .length
      ? ["activities" as const]
      : []),
    ...(data.friends.length ? ["friends" as const] : []),
    ...([self, ...data.friends].filter((p) => p.bestStreak > 0).length >= 2
      ? ["streaks" as const]
      : []),
  ];
}
export function journeyData(
  entries: ActivityEntry[],
  metrics: MetricEntry[],
  activities: Activity[],
): JourneyData {
  const dates = [
    ...entries.map((e) => new Date(e.datetime)),
    ...metrics.map((e) => new Date(e.createdAt)),
  ].sort((a, b) => +a - +b);
  if (!dates.length) return { days: [], lines: [], photos: [] };
  const days = eachDayOfInterval({
    start: startOfDay(dates[0]),
    end: startOfDay(dates.at(-1)!),
  });
  const dayIndex = (d: string | Date) =>
    differenceInCalendarDays(new Date(d), days[0]);
  const top = activityTotals(entries, activities)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const lines: JourneyData["lines"] = top.map((t, i) => ({
    id: t.activity.id,
    emoji: t.activity.emoji,
    color: ["#f59e0b", "#ec4899", "#10b981"][i],
    points: days
      .map((_, day) => ({
        day,
        value: entries.filter(
          (e) =>
            e.activityId === t.activity.id &&
            dayIndex(e.datetime) <= day &&
            dayIndex(e.datetime) >= day - 29,
        ).length,
      }))
      .slice(6),
  }));
  const mood = days
    .map((_, day) => {
      const vals = metrics.filter(
        (e) =>
          dayIndex(e.createdAt) <= day && dayIndex(e.createdAt) >= day - 29,
      );
      return {
        day,
        value: vals.length
          ? vals.reduce((s, e) => s + e.rating, 0) / vals.length
          : 0,
        count: vals.length,
      };
    })
    .slice(29)
    .filter((p) => p.count > 0);
  if (mood.length > 1)
    lines.unshift({ id: "mood", emoji: "😊", color: "#000000", points: mood });
  const photos: JourneyData["photos"] = [];
  for (const entry of entries
    .filter((e) => photoUrl(e))
    .sort((a, b) => (b.reactions?.length ?? 0) - (a.reactions?.length ?? 0))) {
    const day = dayIndex(entry.datetime);
    if (photos.every((p) => Math.abs(p.day - day) >= 14))
      photos.push({ entry, day });
  }
  return { days, lines, photos: photos.sort((a, b) => a.day - b.day) };
}
