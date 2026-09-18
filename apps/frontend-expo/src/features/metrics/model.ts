import { startOfDay, subDays } from "date-fns";
import { dayKey } from "@/core/dates";
import type { Activity, ActivityEntry, MetricEntry } from "@/core/types";
import type { SleepScore } from "@/features/health/sleep-types";
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
export function correlations(
  metrics: MetricEntry[],
  activities: Activity[],
  entries: ActivityEntry[],
) {
  // The PWA correlates the complete numeric history, including historical
  // scales. Do not apply the current 1–5 heatmap filter to this dataset.
  const valid = metrics.filter((entry) => Number.isFinite(entry.rating));
  if (valid.length < 7) return [];
  return activities
    .map((activity) => {
      const x: number[] = valid.map((metric) =>
        entries.some(
          (entry) =>
            !entry.deletedAt &&
            entry.activityId === activity.id &&
            new Date(entry.datetime) >=
              subDays(new Date(metric.createdAt), 1) &&
            new Date(entry.datetime) <= new Date(metric.createdAt) &&
            (new Date(metric.createdAt) < new Date("2025-11-06T00:00:00Z") ||
              new Date(entry.createdAt) < new Date(metric.createdAt)),
        )
          ? 1
          : 0,
      );
      const y = valid.map((e) => e.rating);
      const n = x.length;
      const sx = x.reduce((a, b) => a + b, 0),
        sy = y.reduce((a, b) => a + b, 0);
      const denominator = Math.sqrt(
        (n * x.reduce((a, b) => a + b * b, 0) - sx * sx) *
          (n * y.reduce((a, b) => a + b * b, 0) - sy * sy),
      );
      const correlation = denominator
        ? (n * x.reduce((a, b, i) => a + b * y[i], 0) - sx * sy) / denominator
        : 0;
      return {
        activity,
        correlation,
        sampleSize: x.filter((value) => value === 1).length,
      };
    })
    .filter((c) => c.sampleSize > 0)
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
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

export interface SleepCorrelation {
  // Null until enough paired nights exist to support a correlation.
  correlation: number | null;
  sampleSize: number;
  // Averages make a 0-100 estimate comparable with 1-5 ratings even at the
  // small sample sizes early users have.
  higherAverage: number | null;
  lowerAverage: number | null;
  bands: SleepBand[];
  // Nights whose score is still being learned, so their quality is an estimate
  // from the components that were computed instead of a settled total.
  estimatedNights: number;
  // Three paired nights is the minimum that can support a correlation or band.
  comparable: boolean;
}

export const MIN_SLEEP_PAIRS = 3;

const bandFor = (quality: number) =>
  quality >= 80 ? "Good nights" : quality >= 60 ? "Fair nights" : "Poor nights";

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const pearson = (x: number[], y: number[]) => {
  const n = x.length;
  const sx = x.reduce((a, b) => a + b, 0),
    sy = y.reduce((a, b) => a + b, 0);
  const denominator = Math.sqrt(
    (n * x.reduce((a, b) => a + b * b, 0) - sx * sx) *
      (n * y.reduce((a, b) => a + b * b, 0) - sy * sy),
  );
  return denominator
    ? (n * x.reduce((a, b, i) => a + b * y[i], 0) - sx * sy) / denominator
    : 0;
};

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
export function sleepCorrelation(
  scores: SleepScore[],
  metrics: MetricEntry[],
): SleepCorrelation | null {
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
  // Fewer than three paired nights cannot support a correlation, but the row
  // and its bands still render so sleep reads as a contributor as soon as there
  // is any paired night to show.
  const comparable = pairs.length >= MIN_SLEEP_PAIRS;
  const good = pairs.filter((pair) => pair.quality >= 80).map((p) => p.rating);
  const rest = pairs.filter((pair) => pair.quality < 80).map((p) => p.rating);
  return {
    correlation: comparable
      ? pearson(
          pairs.map((pair) => pair.quality),
          pairs.map((pair) => pair.rating),
        )
      : null,
    sampleSize: pairs.length,
    higherAverage: comparable ? mean(good) : null,
    lowerAverage: comparable ? mean(rest) : null,
    bands,
    estimatedNights: pairs.filter((pair) => pair.total == null).length,
    comparable,
  };
}

export function correlationAppearance(
  value: number | null,
  count: number,
) {
  const reliability =
    count < 5
      ? { label: "Insufficient", dot: "#d1d5db", darkLabel: "#e5e7eb" }
      : count < 15
        ? { label: "Weak", dot: "#fb923c", darkLabel: "#ea580c" }
        : count < 30
          ? { label: "Medium", dot: "#60a5fa", darkLabel: "#2563eb" }
          : { label: "Confident", dot: "#a855f7", darkLabel: "#9333ea" };
  return {
    ...reliability,
    insufficient: count < 5,
    color:
      value === null || Math.abs(value) < 0.1
        ? "#9ca3af"
        : value >= 0
          ? "#22c55e"
          : "#ef4444",
  };
}
