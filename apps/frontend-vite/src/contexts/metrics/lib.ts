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

// Check if activity happened within window
const activityHappenedWithinWindow = (
  activityId: string,
  entries: ActivityEntry[],
  date: Date
): boolean => {
  const targetDate = new Date(date);
  const windowStart = new Date(targetDate);
  windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

  return entries.some((entry) => {
    if (entry.activityId !== activityId) return false;
    const entryDate = new Date(entry.date);
    return entryDate >= windowStart && entryDate <= targetDate;
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
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const correlations = activities
    .map((activity) => {
      const binaryActivityArray = metricEntries.map((entry) => {
        const didActivity = activityHappenedWithinWindow(
          activity.id,
          activityEntries,
          entry.date
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
    .filter((entry) => new Date(entry.date) >= sevenDaysAgo)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Fill in missing days with 0
  const weekData: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const entryForDay = metricEntries.find((entry) =>
      isSameDay(entry.date, date)
    );

    weekData.push(entryForDay ? entryForDay.rating : 0);
  }

  return weekData;
};
