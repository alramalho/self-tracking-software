import { subDays } from "date-fns";
import { dayKey } from "@/core/dates";
import type { Activity, ActivityEntry, MetricEntry } from "@/core/types";
import type { SleepScore } from "@/features/health/sleep-types";
import type { ActivityFinding } from "./types";
// Metric timestamps encode a calendar date at UTC midnight, unlike activity timestamps.
export const metricDayKey = (date: import("@/core/types").DateValue) =>
  new Date(date).toISOString().slice(0, 10);
export const validRatings = (entries: MetricEntry[]) =>
  entries.filter((e) => !e.skipped && e.rating >= 1 && e.rating <= 5);
export const average = (entries: MetricEntry[]) =>
  entries.length
    ? entries.reduce((s, e) => s + e.rating, 0) / entries.length
    : null;
export function metricSummary(entries: MetricEntry[], now = new Date()) {
  const valid = validRatings(entries);
  const current = valid.filter(
    (e) =>
      metricDayKey(e.createdAt) >= dayKey(subDays(now, 6)) &&
      metricDayKey(e.createdAt) <= dayKey(now),
  );
  const previous = valid.filter(
    (e) =>
      metricDayKey(e.createdAt) >= dayKey(subDays(now, 13)) &&
      metricDayKey(e.createdAt) < dayKey(subDays(now, 6)),
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
export function dailyRatings(entries: MetricEntry[]) {
  const groups = new Map<string, MetricEntry[]>();
  for (const entry of validRatings(entries)) {
    const key = metricDayKey(entry.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return new Map([...groups].map(([key, rows]) => [key, average(rows)!]));
}
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

// Under this many days there is no finding to show, only what is still needed.
export const MIN_FINDING_DAYS = 5;
// A smaller difference than this reads as "about the same", not as a finding.
export const CLEAR_DIFFERENCE = 0.05;

// How much there is to go on, as zero to three bars. Zero means too early.
export const signalStrength = (days: number, first = MIN_FINDING_DAYS) =>
  days < first ? 0 : days < 15 ? 1 : days < 30 ? 2 : 3;

// Compares the days someone logged an activity with the days they did not.
// A check-in is saved as a calendar date, so the join is the day itself: the
// activity counts for the check-in given on the same day.
export function activityFindings(
  metrics: MetricEntry[],
  activities: Activity[],
  entries: ActivityEntry[],
): ActivityFinding[] {
  if (validRatings(metrics).length < 7) return [];
  const ratings = [...dailyRatings(metrics)];
  const evidence = (row: ActivityFinding) => Math.min(row.days, row.otherDays);
  return activities
    .flatMap((activity) => {
      const logged = new Set(
        entries
          .filter((entry) => !entry.deletedAt && entry.activityId === activity.id)
          .map((entry) => dayKey(entry.datetime)),
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
            : evidence(b) - evidence(a),
    );
}

// Sleep reaches the insights island through the activity row shape so it reads
// as one more contributor, but it is synced rather than logged.
export const sleepActivity: Activity = {
  id: "sleep-score",
  title: "Sleep score",
  emoji: "🛌",
  measure: "score",
};

export interface SleepBand {
  label: string;
  average: number | null;
  count: number;
}

export interface SleepFinding {
  // Share by which ratings differ after nights scoring 80+, against all other
  // nights. Null until three paired nights exist and both kinds have a rating.
  difference: number | null;
  sampleSize: number;
  // Averages make a 0-100 estimate comparable with 1-5 ratings even at the
  // small sample sizes early users have.
  higherAverage: number | null;
  lowerAverage: number | null;
  bands: SleepBand[];
  // Nights whose score is still being learned, so their quality is an estimate
  // from the components that were computed instead of a settled total.
  estimatedNights: number;
  // Three paired nights is the minimum that can support a comparison or band.
  comparable: boolean;
}

export const MIN_SLEEP_PAIRS = 3;

const bandFor = (quality: number) =>
  quality >= 80 ? "Good nights" : quality >= 60 ? "Fair nights" : "Poor nights";

// A night whose total is withheld is not scored zero: while the score is still
// learning, the components that were computed describe how the night actually
// went. Scaling their earned share to 100 keeps a nightly quality value in the
// same range as a settled score, so the check-in comparison stays meaningful
// before a total exists.
const COMPONENT_MAXIMA = [50, 30, 20] as const;
export function estimatedSleepQuality(score: SleepScore): number | null {
  if (score.total != null) return score.total;
  const earned = [
    score.durationPoints,
    score.consistencyPoints,
    score.interruptionPoints,
  ];
  const available = earned.filter((value): value is number => value != null);
  if (!available.length) return null;
  const availableMaximum = COMPONENT_MAXIMA.filter(
    (_, index) => earned[index] != null,
  ).reduce((sum, value) => sum + value, 0);
  return Math.round(
    (available.reduce((sum, value) => sum + value, 0) / availableMaximum) * 100,
  );
}

// Each check-in is paired with the night that ended that morning: the rating
// someone records for a day reflects how they slept into it. Unlike activities
// there is no event to log after the fact, so the day key is the join.
export function sleepFinding(
  scores: SleepScore[],
  metrics: MetricEntry[],
): SleepFinding | null {
  const nights = new Map(
    scores.flatMap((score) => {
      const quality = estimatedSleepQuality(score);
      return quality == null
        ? []
        : [[score.date, { quality, total: score.total }] as const];
    }),
  );
  // The sleep bands are labelled "avg rating" and drawn against the 1-5
  // check-in scale, so an out-of-range historical or imported rating is
  // excluded rather than stretching a bar past the end of its track.
  const valid = validRatings(metrics);
  // No synced night carries any quality yet, so sleep is not a contributor.
  if (!nights.size || !valid.length) return null;
  const pairs = valid.flatMap((entry) => {
    const night = nights.get(metricDayKey(entry.createdAt));
    return night === undefined
      ? []
      : [{ quality: night.quality, total: night.total, rating: entry.rating }];
  });
  const bands = ["Good nights", "Fair nights", "Poor nights"].map((label) => {
    const ratings = pairs
      .filter((pair) => bandFor(pair.quality) === label)
      .map((pair) => pair.rating);
    return { label, average: mean(ratings), count: ratings.length };
  });
  // Fewer than three paired nights cannot support a comparison, but the row
  // and its bands still render so sleep reads as a contributor as soon as there
  // is any paired night to show.
  const comparable = pairs.length >= MIN_SLEEP_PAIRS;
  const good = pairs.filter((pair) => pair.quality >= 80).map((p) => p.rating);
  const rest = pairs.filter((pair) => pair.quality < 80).map((p) => p.rating);
  const higherAverage = comparable ? mean(good) : null;
  const lowerAverage = comparable ? mean(rest) : null;
  return {
    difference:
      higherAverage !== null && lowerAverage !== null
        ? (higherAverage - lowerAverage) / lowerAverage
        : null,
    sampleSize: pairs.length,
    higherAverage,
    lowerAverage,
    bands,
    estimatedNights: pairs.filter((pair) => pair.total == null).length,
    comparable,
  };
}
