"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserPlan, Metric, MetricEntry, Activity } from "@/contexts/UserPlanContext";
import {
  Loader2,
} from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { defaultMetrics } from "../metrics";
import { MetricTrendCard } from "@/components/metrics/MetricTrendCard";
import { MetricInsightsCard } from "@/components/metrics/MetricInsightsCard";
import { MetricSelector } from "@/components/metrics/MetricSelector";
import { AddMetricPopover } from "@/components/metrics/AddMetricPopover";
import { TrendHelpPopover } from "@/components/metrics/TrendHelpPopover";
import { CorrelationHelpPopover } from "@/components/metrics/CorrelationHelpPopover";
import { MetricsAINotification } from "@/components/metrics/MetricsAINotification";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation


export default function InsightsDashboardPage() {
  const {
    useCurrentUserDataQuery,
    useMetricsAndEntriesQuery,
  } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData, isLoading } = metricsAndEntriesQuery;
  const userMetrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];
  const activities = userData?.activities || [];
  const activityEntries = userData?.activityEntries || [];
  const hasMetrics = userMetrics.length > 0;
  const router = useRouter();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [helpMetricId, setHelpMetricId] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [trendHelpMetricId, setTrendHelpMetricId] = useState<string | null>(
    null
  );
  const [isAddMetricOpen, setIsAddMetricOpen] = useState(false);
  const [selectedNewMetric, setSelectedNewMetric] = useState<string | null>(
    null
  );
  const [isCreatingMetric, setIsCreatingMetric] = useState(false);
  const api = useApiWithAuth();
  const { maxMetrics } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  useEffect(() => {
    if (!isLoading && !hasMetrics) {
      router.push("/insights/onboarding");
    }
  }, [isLoading, hasMetrics]);

  // Set the first metric as selected when metrics load
  useEffect(() => {
    if (userMetrics.length > 0 && !selectedMetricId) {
      setSelectedMetricId(userMetrics[0].id);
    }
  }, [userMetrics]);

  // Find the metric with the most entries
  const metricEntryCounts = userMetrics.map((metric) => ({
    metric,
    count: entries.filter((entry) => entry.metric_id === metric.id).length,
  }));

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

    return (
      <Card className="p-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">⚡️ Building your insights</h2>
            <p className="text-muted-foreground">
              {targetEntries === 15
                ? "We need more data to generate meaningful insights. Keep logging your metrics daily!"
                : "We've analyzed your data but haven't found meaningful correlations with your activities yet. This could mean your activities and metrics don't overlap enough, or we need more data to find reliable patterns. Keep logging!"}
            </p>
          </div>


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

  const handleAddMetricClick = () => {
    if (userMetrics.length >= maxMetrics) {
      setShowUpgradePopover(true);
      return;
    }
    setIsAddMetricOpen(true);
  };

  const handleAddMetric = async () => {
    if (!selectedNewMetric) return;

    if (userMetrics.length >= maxMetrics) {
      setShowUpgradePopover(true);
      return;
    }

    setIsCreatingMetric(true);
    try {
      const metricData = defaultMetrics.find(
        (f) => f.title === selectedNewMetric
      );
      if (!metricData) return;

      await api.post("/metrics", {
        title: metricData.title,
        emoji: metricData.emoji,
      });

      metricsAndEntriesQuery.refetch();
      setIsAddMetricOpen(false);
      setSelectedNewMetric(null);
      toast.success("Metric added successfully");
    } catch (error) {
      console.error("Error creating metric:", error);
      toast.error("Failed to add metric");
    } finally {
      setIsCreatingMetric(false);
    }
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

  const calculateMetricTrend = (metricEntries: MetricEntry[]) => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get entries from the last 14 days and sort them
    const recentEntries = metricEntries
      .filter((entry) => new Date(entry.date) >= twoWeeksAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (recentEntries.length < 2) return 0;

    // Split entries into this week and last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeekEntries = recentEntries.filter(
      (entry) => new Date(entry.date) >= oneWeekAgo
    );
    const lastWeekEntries = recentEntries.filter(
      (entry) => new Date(entry.date) < oneWeekAgo
    );

    // Calculate averages
    const thisWeekAvg =
      thisWeekEntries.length > 0
        ? thisWeekEntries.reduce((sum, entry) => sum + entry.rating, 0) /
          thisWeekEntries.length
        : 0;
    const lastWeekAvg =
      lastWeekEntries.length > 0
        ? lastWeekEntries.reduce((sum, entry) => sum + entry.rating, 0) /
          lastWeekEntries.length
        : 0;

    // Calculate trend percentage
    if (lastWeekAvg === 0) return 0;
    return ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
  };

  const prepareChartData = (metricId: string) => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const metricEntries = entries
      .filter((entry) => entry.metric_id === metricId)
      .filter((entry) => new Date(entry.date) >= fourteenDaysAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return metricEntries.map((entry) => ({
      date: new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      rating: entry.rating,
    }));
  };

  // Render insights when we have enough data
  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      {/* {userPaidPlanType == "supporter" && <MetricsAINotification />} */}

      <MetricSelector
        metrics={userMetrics}
        selectedMetricId={selectedMetricId}
        onMetricSelect={setSelectedMetricId}
        onAddMetricClick={handleAddMetricClick}
      />

      <AddMetricPopover
        isOpen={isAddMetricOpen}
        onClose={() => {
          setIsAddMetricOpen(false);
          setSelectedNewMetric(null);
        }}
        defaultMetrics={defaultMetrics}
        existingMetrics={metricsAndEntriesData?.metrics || []}
        selectedMetric={selectedNewMetric}
        onMetricSelect={setSelectedNewMetric}
        onAddMetric={handleAddMetric}
        isCreating={isCreatingMetric}
      />

      <div className="space-y-4">
        {userMetrics
          .filter((metric) => metric.id === selectedMetricId)
          .map((metric) => {
            const count = entries.filter(
              (e) => e.metric_id === metric.id
            ).length;
            const correlations =
              count >= 15
                ? calculateMetricCorrelations(metric.id)
                    .filter((c): c is { activity: Activity; correlation: number } => c !== null)
                    .map(c => ({
                      activity: c.activity,
                      correlation: c.correlation
                    }))
                : [];
            const hasCorrelations = correlations.length > 0;
            const chartData = prepareChartData(metric.id);
            const trend = calculateMetricTrend(
              entries.filter((e) => e.metric_id === metric.id)
            );

            // Calculate weekly averages for display
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const recentEntries = entries
              .filter((e) => e.metric_id === metric.id)
              .filter((entry) => new Date(entry.date) >= twoWeeksAgo)
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              );

            const thisWeekEntries = recentEntries.filter(
              (entry) => new Date(entry.date) >= oneWeekAgo
            );
            const lastWeekEntries = recentEntries.filter(
              (entry) => new Date(entry.date) < oneWeekAgo
            );

            const thisWeekAvg =
              thisWeekEntries.length > 0
                ? thisWeekEntries.reduce(
                    (sum, entry) => sum + entry.rating,
                    0
                  ) / thisWeekEntries.length
                : 0;
            const lastWeekAvg =
              lastWeekEntries.length > 0
                ? lastWeekEntries.reduce(
                    (sum, entry) => sum + entry.rating,
                    0
                  ) / lastWeekEntries.length
                : 0;

            if (!hasCorrelations) {
              const nextMilestone = getNextMilestone(count);
              return renderProgressUI(nextMilestone, metric);
            }

            return (
              <div key={metric.id} className="space-y-4">
                <MetricTrendCard
                  metric={metric}
                  trend={trend}
                  chartData={chartData}
                  thisWeekAvg={thisWeekAvg}
                  lastWeekAvg={lastWeekAvg}
                  thisWeekEntries={thisWeekEntries}
                  lastWeekEntries={lastWeekEntries}
                  onHelpClick={() => setTrendHelpMetricId(metric.id)}
                />

                <MetricInsightsCard
                  metric={metric}
                  correlations={correlations}
                  onHelpClick={() => setHelpMetricId(metric.id)}
                />

                <TrendHelpPopover
                  isOpen={trendHelpMetricId === metric.id}
                  onClose={() => setTrendHelpMetricId(null)}
                  metricTitle={metric.title}
                />

                <CorrelationHelpPopover
                  isOpen={helpMetricId === metric.id}
                  onClose={() => setHelpMetricId(null)}
                  metricTitle={metric.title}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
