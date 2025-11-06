import {
  type Activity,
  type ActivityEntry,
  type MetricEntry,
} from "@tsw/prisma";
import { isSameDay } from "date-fns";

export const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation
export const MINIMUM_ENTRIES = 7;
export const MAX_METRICS = 2;

export interface MetricCorrelation {
  activity: Activity;
  correlation: number;
}

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
