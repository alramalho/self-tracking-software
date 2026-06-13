import {
  type Activity,
  type ActivityEntry,
  type MetricEntry,
} from "@tsw/prisma";
import { addDays, endOfDay, isSameDay, startOfDay, subDays } from "date-fns";

export const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation
export const MINIMUM_ENTRIES = 7;
export const MAX_METRICS = 2;

export interface MetricCorrelation {
  activity: Activity;
  correlation: number;
}

export interface MetricContextEvent {
  id: string;
  title: string;
  description?: string | null;
  occurredAt: Date | null;
  endedAt: Date | null;
}

export interface MetricEventImpact {
  event: MetricContextEvent;
  duringAverage: number;
  baselineAverage: number;
  delta: number;
  duringEntryCount: number;
  baselineEntryCount: number;
  startedAt: Date;
  endedAt: Date;
}

const EVENT_BASELINE_WINDOW_DAYS = 30;
const MINIMUM_EVENT_RANGE_ENTRIES = 2;
const MINIMUM_SINGLE_DAY_EVENT_ENTRIES = 1;
const MINIMUM_EVENT_BASELINE_ENTRIES = 5;
const MINIMUM_EVENT_DELTA = 0.7;

const averageRating = (entries: MetricEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length;

const resolveEventRange = (event: MetricContextEvent) => {
  const rawStart = event.occurredAt || event.endedAt;
  if (!rawStart) return null;

  const start = startOfDay(new Date(rawStart));
  const end = endOfDay(new Date(event.endedAt || rawStart));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return start <= end
    ? { startedAt: start, endedAt: end }
    : { startedAt: startOfDay(end), endedAt: endOfDay(start) };
};

// Calculate Pearson correlation coefficient
const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumXX = x.reduce((a, b) => a + b * b, 0);
  const sumYY = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
};

// Cutoff date for timestamp-based filtering (January 6, 2025)
// Metric entries created after this date will only count activities logged before them
const TIMESTAMP_FILTERING_CUTOFF = new Date('2025-01-06T00:00:00Z');

// Check if activity happened within window
// If metricCreatedAt is provided and after the cutoff date, only count activities
// that were logged before the metric entry
const activityHappenedWithinWindow = (
  activityId: string,
  entries: ActivityEntry[],
  date: Date,
  metricCreatedAt?: Date
): boolean => {
  const targetDate = new Date(date);
  const windowStart = new Date(targetDate);
  windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

  return entries.some((entry) => {
    if (entry.activityId !== activityId) return false;

    const entryDate = new Date(entry.datetime);
    const activityCreatedAt = new Date(entry.createdAt);

    // Check date window
    const inDateWindow = entryDate >= windowStart && entryDate <= targetDate;

    if (!inDateWindow) return false;

    // If metric was created after cutoff date, enforce timestamp filtering
    if (metricCreatedAt && metricCreatedAt >= TIMESTAMP_FILTERING_CUTOFF) {
      return activityCreatedAt < metricCreatedAt;
    }

    // For historical data (before cutoff), don't enforce timestamp filtering
    return true;
  });
};

// Calculate correlations for a metric
const calculateMetricCorrelations = (
  metricId: string,
  entries: MetricEntry[],
  activities: Activity[],
  activityEntries: ActivityEntry[]
): MetricCorrelation[] => {
  const metricEntries = entries
    .filter((entry) => entry.metricId === metricId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const correlations = activities
    .map((activity) => {
      const binaryActivityArray = metricEntries.map((entry) => {
        const didActivity = activityHappenedWithinWindow(
          activity.id,
          activityEntries,
          entry.createdAt,
          new Date(entry.createdAt) // Pass metric entry's creation timestamp
        );
        return didActivity ? 1 : 0;
      });

      // Only calculate correlation if the activity has some occurrences
      if (binaryActivityArray.some((v) => v === 1)) {
        const ratings = metricEntries.map((e) => e.rating);
        const correlation = calculatePearsonCorrelation(
          ratings,
          binaryActivityArray
        );
        return {
          activity,
          correlation,
        };
      }
      return null;
    })
    .filter(
      (correlation): correlation is MetricCorrelation => correlation !== null
    );

  // Sort by absolute correlation value
  return correlations.sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  );
};

// Get correlations for a metric
const getMetricCorrelations = (
  metricId: string,
  entries: MetricEntry[],
  activities: Activity[],
  activityEntries: ActivityEntry[]
): MetricCorrelation[] => {
  const count = entries.filter((e) => e.metricId === metricId).length;

  if (count < MINIMUM_ENTRIES) {
    return [];
  }

  return calculateMetricCorrelations(
    metricId,
    entries,
    activities,
    activityEntries
  );
};

export const getPositiveCorrelations = (
  metricId: string,
  entries: MetricEntry[],
  activities: Activity[],
  activityEntries: ActivityEntry[]
): MetricCorrelation[] => {
  return getMetricCorrelations(
    metricId,
    entries,
    activities,
    activityEntries
  ).filter((correlation) => correlation.correlation > 0);
};

export const getNegativeCorrelations = (
  metricId: string,
  entries: MetricEntry[],
  activities: Activity[],
  activityEntries: ActivityEntry[]
): MetricCorrelation[] => {
  return getMetricCorrelations(
    metricId,
    entries,
    activities,
    activityEntries
  ).filter((correlation) => correlation.correlation < 0);
};

export const getMetricEventImpacts = (
  metricId: string,
  entries: MetricEntry[],
  events: MetricContextEvent[],
): MetricEventImpact[] => {
  const metricEntries = entries
    .filter((entry) => entry.metricId === metricId && !entry.skipped)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  if (metricEntries.length < MINIMUM_ENTRIES) return [];

  return events
    .map((event) => {
      const range = resolveEventRange(event);
      if (!range) return null;

      const { startedAt, endedAt } = range;
      const duringEntries = metricEntries.filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        return entryDate >= startedAt && entryDate <= endedAt;
      });
      const eventSpansMultipleDays = !isSameDay(startedAt, endedAt);
      const minimumDuringEntries = eventSpansMultipleDays
        ? MINIMUM_EVENT_RANGE_ENTRIES
        : MINIMUM_SINGLE_DAY_EVENT_ENTRIES;

      if (duringEntries.length < minimumDuringEntries) return null;

      const baselineStart = subDays(startedAt, EVENT_BASELINE_WINDOW_DAYS);
      const baselineEnd = addDays(endedAt, EVENT_BASELINE_WINDOW_DAYS);
      let baselineEntries = metricEntries.filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        const isInsideEvent = entryDate >= startedAt && entryDate <= endedAt;
        const isInsideWindow =
          entryDate >= baselineStart && entryDate <= baselineEnd;
        return !isInsideEvent && isInsideWindow;
      });

      if (baselineEntries.length < MINIMUM_EVENT_BASELINE_ENTRIES) {
        baselineEntries = metricEntries.filter((entry) => {
          const entryDate = new Date(entry.createdAt);
          return entryDate < startedAt || entryDate > endedAt;
        });
      }

      if (baselineEntries.length < MINIMUM_EVENT_BASELINE_ENTRIES) return null;

      const duringAverage = averageRating(duringEntries);
      const baselineAverage = averageRating(baselineEntries);
      const delta = duringAverage - baselineAverage;

      if (Math.abs(delta) < MINIMUM_EVENT_DELTA) return null;

      return {
        event,
        duringAverage,
        baselineAverage,
        delta,
        duringEntryCount: duringEntries.length,
        baselineEntryCount: baselineEntries.length,
        startedAt,
        endedAt,
      };
    })
    .filter((impact): impact is MetricEventImpact => impact !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
};

// Get last 7 days of data for a metric
export const getMetricWeekData = (
  metricId: string,
  entries: MetricEntry[]
): number[] => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const metricEntries = entries
    .filter((entry) => entry.metricId === metricId)
    .filter((entry) => new Date(entry.createdAt) >= sevenDaysAgo)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Fill in missing days with 0
  const weekData: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const entryForDay = metricEntries.find((entry) =>
      isSameDay(entry.createdAt, date)
    );

    weekData.push(entryForDay ? entryForDay.rating : 0);
  }

  return weekData;
};
