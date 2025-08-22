import { useUserPlan } from "@/contexts/UserGlobalContext";
import { Activity } from "@tsw/prisma";
import { isSameDay } from "date-fns";

const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation
const MINIMUM_ENTRIES = 7;

interface MetricCorrelation {
  activity: Activity;
  correlation: number;
}

export function useMetrics() {
  const { useCurrentUserDataQuery, useMetricsAndEntriesQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const { data: metricsAndEntriesData } = useMetricsAndEntriesQuery();
  
  const userMetrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];
  const activities = userData?.activities || [];
  const activityEntries = userData?.activityEntries || [];

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
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Check if activity happened within window
  const activityHappenedWithinWindow = (
    activityId: string,
    date: Date
  ): boolean => {
    const targetDate = new Date(date);
    const windowStart = new Date(targetDate);
    windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

    return activityEntries.some((entry) => {
      if (entry.activityId !== activityId) return false;
      const entryDate = new Date(entry.date);
      return entryDate >= windowStart && entryDate <= targetDate;
    });
  };

  // Calculate correlations for a metric
  const calculateMetricCorrelations = (metricId: string): MetricCorrelation[] => {
    const metricEntries = entries
      .filter((entry) => entry.metricId === metricId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const correlations = activities
      .map((activity) => {
        const binaryActivityArray = metricEntries.map((entry) => {
          const didActivity = activityHappenedWithinWindow(
            activity.id,
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
      .filter((correlation): correlation is MetricCorrelation => correlation !== null);

    // Sort by absolute correlation value
    return correlations.sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );
  };

  // Get correlations for a metric
  const getMetricCorrelations = (metricId: string): MetricCorrelation[] => {
    const count = entries.filter((e) => e.metricId === metricId).length;
    
    if (count < MINIMUM_ENTRIES) {
      return [];
    }
    
    return calculateMetricCorrelations(metricId);
  };

  // Get positive correlations for a metric
  const getPositiveCorrelations = (metricId: string): MetricCorrelation[] => {
    return getMetricCorrelations(metricId).filter(
      (correlation) => correlation.correlation > 0
    );
  };

  // Get negative correlations for a metric
  const getNegativeCorrelations = (metricId: string): MetricCorrelation[] => {
    return getMetricCorrelations(metricId).filter(
      (correlation) => correlation.correlation < 0
    );
  };

  // Helper function to format correlation as a simple string for display
  const formatCorrelationString = (correlation: MetricCorrelation): string => {
    return `${correlation.activity.emoji || "📊"} ${correlation.activity.title}`;
  };

  // Get last 7 days of data for a metric
  const getMetricWeekData = (metricId: string): number[] => {
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
      
      const entryForDay = metricEntries.find(
        (entry) => isSameDay(entry.date, date)
      );
      
      weekData.push(entryForDay ? entryForDay.rating : 0);
    }
    
    return weekData;
  };

  return {
    userMetrics,
    entries,
    activities,
    activityEntries,
    getMetricCorrelations,
    getPositiveCorrelations,
    getNegativeCorrelations,
    formatCorrelationString,
    getMetricWeekData,
    MINIMUM_ENTRIES,
  };
} 