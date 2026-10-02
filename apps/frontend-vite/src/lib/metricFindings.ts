// The numbers behind the Metrics page, kept apart from the screens so they can
// be read and tested in one place. Same rules as the iPhone app
// (apps/frontend-expo/src/features/metrics/model.ts).
import type { Activity, ActivityEntry, MetricEntry } from "@tsw/prisma";
import { format, subDays } from "date-fns";

type DateValue = Date | string;

export interface ActivityFinding {
  activity: Pick<Activity, "id" | "title" | "emoji">;
  // Average rating on days with the activity, and on all other rated days.
  average: number;
  otherAverage: number | null;
  // Share by which the two averages differ, e.g. -0.21 for 21% lower. Null
  // while either kind of day has fewer than five ratings.
  difference: number | null;
  days: number;
  otherDays: number;
}

// The calendar day on this device, e.g. "2026-09-01".
export const localDayKey = (date: DateValue) =>
  format(new Date(date), "yyyy-MM-dd");
// A check-in is saved as its calendar date at UTC midnight (see
// todaysLocalDate), so its day is read in UTC, unlike an activity timestamp.
export const metricDayKey = (date: DateValue) =>
  new Date(date).toISOString().slice(0, 10);

export const validRatings = (entries: MetricEntry[]) =>
  entries.filter((e) => !e.skipped && e.rating >= 1 && e.rating <= 5);
export const average = (entries: MetricEntry[]) =>
  entries.length
    ? entries.reduce((sum, e) => sum + e.rating, 0) / entries.length
    : null;
const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

// The last seven days against the seven before.
export function metricSummary(entries: MetricEntry[], now = new Date()) {
  const valid = validRatings(entries);
  const current = valid.filter(
    (e) =>
      metricDayKey(e.createdAt) >= localDayKey(subDays(now, 6)) &&
      metricDayKey(e.createdAt) <= localDayKey(now)
  );
  const previous = valid.filter(
    (e) =>
      metricDayKey(e.createdAt) >= localDayKey(subDays(now, 13)) &&
      metricDayKey(e.createdAt) < localDayKey(subDays(now, 6))
  );
  const currentAverage = average(current);
  const previousAverage = average(previous);
  return {
    currentAverage,
    previousAverage,
    trend:
      currentAverage !== null && previousAverage !== null && previousAverage > 0
        ? ((currentAverage - previousAverage) / previousAverage) * 100
        : null,
    count: valid.length,
  };
}

// One point per rated day: the average of that day's check-ins.
export function dailyRatings(entries: MetricEntry[]) {
  const groups = new Map<string, MetricEntry[]>();
  for (const entry of validRatings(entries)) {
    const key = metricDayKey(entry.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return new Map([...groups].map(([key, rows]) => [key, average(rows)!]));
}

// Under this many days there is no finding to show, only what is still needed.
export const MIN_FINDING_DAYS = 5;
// A smaller difference than this reads as "about the same", not as a finding.
export const CLEAR_DIFFERENCE = 0.05;

// How much there is to go on, as zero to three bars. Zero means too early.
export const signalStrength = (days: number) =>
  days < MIN_FINDING_DAYS ? 0 : days < 15 ? 1 : days < 30 ? 2 : 3;

// Compares the days someone logged an activity with the days they did not.
// A check-in is saved as a calendar date, so the join is the day itself: the
// activity counts for the check-in given on the same day.
export function activityFindings(
  metrics: MetricEntry[],
  activities: Activity[],
  entries: ActivityEntry[]
): ActivityFinding[] {
  if (validRatings(metrics).length < 7) return [];
  const ratings = [...dailyRatings(metrics)];
  const evidence = (row: ActivityFinding) => Math.min(row.days, row.otherDays);
  return activities
    .flatMap((activity) => {
      const logged = new Set(
        entries
          .filter((entry) => !entry.deletedAt && entry.activityId === activity.id)
          .map((entry) => localDayKey(entry.datetime))
      );
      const on = ratings.filter(([day]) => logged.has(day)).map((r) => r[1]);
      const off = ratings.filter(([day]) => !logged.has(day)).map((r) => r[1]);
      if (!on.length) return [];
      const average = mean(on)!;
      const otherAverage = mean(off);
      return [
        {
          activity,
          average,
          otherAverage,
          // Both kinds of day need enough ratings before a number is fair.
          difference:
            otherAverage !== null &&
            Math.min(on.length, off.length) >= MIN_FINDING_DAYS
              ? (average - otherAverage) / otherAverage
              : null,
          days: on.length,
          otherDays: off.length,
        },
      ];
    })
    .sort((a, b) =>
      a.difference !== null && b.difference !== null
        ? Math.abs(b.difference) - Math.abs(a.difference)
        : a.difference !== null
          ? -1
          : b.difference !== null
            ? 1
            : evidence(b) - evidence(a)
    );
}
