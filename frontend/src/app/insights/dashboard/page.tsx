"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useUserPlan,
  Metric,
  MetricEntry,
} from "@/contexts/UserPlanContext";
import Divider from "@/components/Divider";
import { Loader2 } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { CorrelationEntry } from "@/components/CorrelationEntry";

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation

export default function InsightsDashboardPage() {
  const {
    useCurrentUserDataQuery,
    useMetricsAndEntriesQuery,
    useHasMetricsToLogToday,
  } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData, isLoading } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];
  const activities = userData?.activities || [];
  const activityEntries = userData?.activityEntries || [];
  const hasMetrics = metrics.length > 0;
  const router = useRouter();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  useEffect(() => {
    if (!isLoading && !hasMetrics) {
      router.push("/insights/onboarding");
    }
  }, [isLoading, hasMetrics]);

  // Find the metric with the most entries
  const metricEntryCounts = metrics.map((metric) => ({
    metric,
    count: entries.filter((entry) => entry.metric_id === metric.id).length,
  }));
  const maxEntries = Math.max(...metricEntryCounts.map((m) => m.count));

  const renderProgressUI = (targetEntries: number, specificMetric?: Metric) => {
    const metricsToShow = specificMetric
      ? [
          {
            metric: specificMetric,
            count: entries.filter((e) => e.metric_id === specificMetric.id)
              .length,
          },
        ]
      : metricEntryCounts;

    console.log({metricsToShow});

    return (
      <Card className="p-8">
        <div className="space-y-6">
          {!specificMetric && (
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Building your insights</h2>
              <p className="text-muted-foreground">
                {targetEntries === 15
                  ? "We need more data to generate meaningful insights. Keep logging your metrics daily!"
                  : "We've analyzed your data but haven't found meaningful correlations with your activities yet. This could mean your activities and metrics don't overlap enough, or we need more data to find reliable patterns. Keep logging!"}
              </p>
            </div>
          )}

          <div className="space-y-6">
            {metricsToShow.map(({ metric, count }) => {
              const progressPercent = (count / targetEntries) * 100;
              return (
                <div key={metric.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {metric.emoji} {metric.title}
                    </span>
                    <span className="text-muted-foreground">
                      {count} / {targetEntries} entries
                    </span>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="h-2"
                    indicatorColor={variants.indicator.active}
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Rate {targetEntries} entries to generate meaningful insights.
            </p>
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <p className="text-left">Loading your metrics...</p>
      </div>
    );
  }

  // Calculate Pearson correlation between two arrays
  const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;
  
    const sum1 = x.reduce((a, b) => a + b, 0);
    const sum2 = y.reduce((a, b) => a + b, 0);
    const sum1Sq = x.reduce((a, b) => a + b * b, 0);
    const sum2Sq = y.reduce((a, b) => a + b * b, 0);
    const pSum = x.reduce((a, b, i) => a + b * y[i], 0);
  
    const num = pSum - (sum1 * sum2) / n;
    const den = Math.sqrt(
      (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n)
    );
  
    return den === 0 ? 0 : num / den;
  };

  // Check if an activity happened within the configured window before a date
  const activityHappenedWithinWindow = (
    activityId: string,
    date: string
  ): boolean => {
    const targetDate = new Date(date);
    const windowStart = new Date(targetDate);
    windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

    return activityEntries.some((entry) => {
      const entryDate = new Date(entry.date);
      return (
        entry.activity_id === activityId &&
        entryDate >= windowStart &&
        entryDate <= targetDate
      );
    });
  };

  // Calculate correlations for a metric
  const calculateMetricCorrelations = (metricId: string) => {
    const metricEntries = entries
      .filter((entry) => entry.metric_id === metricId)
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
      .filter(Boolean);

    // Sort by absolute correlation value
    return correlations.sort(
      (a, b) => Math.abs(b!.correlation) - Math.abs(a!.correlation)
    );
  };

  // Calculate next milestone based on current entries
  const getNextMilestone = (entries: number) => {
    const milestones = [15, 30, 45, 60, 90, 120];
    return (
      milestones.find((m) => entries < m) || milestones[milestones.length - 1]
    );
  };

  // Render insights when we have enough data
  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      <div className="space-y-4">
        {metrics.map((metric) => {
          const count = entries.filter((e) => e.metric_id === metric.id).length;
          const correlations = count >= 15 ? calculateMetricCorrelations(metric.id) : [];
          const hasCorrelations = correlations.length > 0;

          if (!hasCorrelations) {
            const nextMilestone = getNextMilestone(count);
            return renderProgressUI(nextMilestone, metric);
          }

          console.log({correlations});
          return (
            <Card key={metric.id} className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">
                    {metric.emoji} {metric.title} Insights
                  </h2>
                  <p className="text-muted-foreground">
                    Here&apos;s how your activities correlate with {metric.title.toLowerCase()}
                  </p>
                </div>
                <div className="space-y-4">
                  {correlations.map((correlation) => {
                    return (
                      <CorrelationEntry
                        key={correlation!.activity.id}
                        title={correlation!.activity.title}
                        pearsonValue={correlation!.correlation}
                      />
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
