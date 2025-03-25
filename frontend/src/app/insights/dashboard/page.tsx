"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useUserPlan,
  Metric,
  MetricEntry,
  Activity,
} from "@/contexts/UserPlanContext";
import { ArrowDown, Loader2 } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { defaultMetrics } from "../metrics";
import { MetricTrendCard } from "@/components/metrics/MetricTrendCard";
import { MetricInsightsCard } from "@/components/metrics/MetricInsightsCard";
import { MetricSelector } from "@/components/metrics/MetricSelector";
import { TrendHelpPopover } from "@/components/metrics/TrendHelpPopover";
import { CorrelationHelpPopover } from "@/components/metrics/CorrelationHelpPopover";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { DailyCheckinCard } from "@/components/DailyCheckinCard";
import { DailyCheckinViewer } from "@/components/DailyCheckinViewer";
import AINotification from "@/components/AINotification";
import { Button } from "@/components/ui/button";
import { subDays } from "date-fns";

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation
const MINIMUM_ENTRIES = 7;
export default function InsightsDashboardPage() {
  const { useCurrentUserDataQuery, useMetricsAndEntriesQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData, isLoading } = metricsAndEntriesQuery;
  const userMetrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];
  const activities = userData?.activities || [];
  const activityEntries = userData?.activityEntries || [];
  const router = useRouter();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [helpMetricId, setHelpMetricId] = useState<string | null>(null);
  // const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [trendHelpMetricId, setTrendHelpMetricId] = useState<string | null>(
    null
  );
  const [aiMessage, setAIMessage] = useState<string | null>(null);
  const [isCreatingMetric, setIsCreatingMetric] = useState(false);
  const api = useApiWithAuth();
  const { setShowUpgradePopover } = useUpgrade();
  const hasLoadedMetricsAndEntries =
    metricsAndEntriesQuery.isSuccess && !!metricsAndEntriesData;
  const { userPaidPlanType } = usePaidPlan();

  const addMetric = async ({
    title,
    emoji,
  }: {
    title: string;
    emoji: string;
  }) => {
    try {
      await api.post("/metrics", {
        title,
        emoji,
      });

      metricsAndEntriesQuery.refetch();
      // setIsAddMetricOpen(false);
      // setSelectedNewMetric(null);
      toast.success("Metric added successfully");
    } catch (error) {
      console.error("Error creating metric:", error);
      toast.error("Failed to add metric");
    } finally {
      setIsCreatingMetric(false);
    }
  };

  const addDefaultMetrics = async () => {
    const hasProductivity = userMetrics.find((m) => m.title === "Productivity");
    const hasEnergy = userMetrics.find((m) => m.title === "Energy");
    const hasHappiness = userMetrics.find((m) => m.title === "Happiness");

    if (!hasProductivity) {
      const productivityMetric = defaultMetrics.find(
        (m) => m.title === "Productivity"
      );
      if (productivityMetric) {
        await addMetric(productivityMetric);
      }
    }
    if (!hasEnergy) {
      const energyMetric = defaultMetrics.find((m) => m.title === "Energy");
      if (energyMetric) {
        await addMetric(energyMetric);
      }
    }
    if (!hasHappiness) {
      const happinessMetric = defaultMetrics.find(
        (m) => m.title === "Happiness"
      );
      if (happinessMetric) {
        await addMetric(happinessMetric);
      }
    }
  };

  if (userMetrics.length === 0) {
    return (
      <div className="mx-auto p-2 max-w-md space-y-8">
        <div className="p-2">
          <AINotification
            messages={[
              `Hey ${
                userData?.user?.username ?? "there"
              }! Welcome to your insights page.`,
              "Here you can track how your activities affect metrics like happiness, energy and productivity.",
              "You can easily log your day by sending me a voice message about how you felt!",
            ]}
            createdAt={new Date().toISOString()}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <ArrowDown className="w-4 h-4 inline-block mr-2" />
          Preview of what your metrics would look like
        </p>

        <div className="pointer-events-none p-4 space-y-2 rounded-lg bg-white/70 border border-gray-200 rounded-lg">
          {/* Add Demo Daily Check-ins */}
          <div>
            <h3 className="text-lg font-semibold my-4">Check-ins</h3>
            <DailyCheckinViewer
              entries={[
                { date: subDays(new Date(), 1).toISOString() },
                { date: subDays(new Date(), 2).toISOString() },
                { date: subDays(new Date(), 5).toISOString() },
              ]}
            />
            <div className="mt-4">
              <DailyCheckinCard aiMessage={null} />
            </div>
          </div>

          {/* Demo Metrics Preview */}
          <div className="space-y-4">
            <MetricTrendCard
              metric={{ id: "demo", title: "Happiness", emoji: "😊" }}
              trend={15}
              chartData={[
                { date: "Feb 25", rating: 2 },
                { date: "Feb 26", rating: 4 },
                { date: "Feb 27", rating: 4 },
                { date: "Feb 28", rating: 4 },
                { date: "Mar 1", rating: 3 },
                { date: "Mar 2", rating: 3 },
                { date: "Mar 3", rating: 5 },
                { date: "Mar 4", rating: 4 },
                { date: "Mar 5", rating: 4 },
                { date: "Mar 6", rating: 3 },
                { date: "Mar 9", rating: 5 },
              ]}
              thisWeekAvg={7.5}
              lastWeekAvg={6.5}
              thisWeekEntries={[
                {
                  id: "demo1",
                  metric_id: "demo",
                  rating: 8,
                  date: "2024-03-09",
                  created_at: "2024-03-09T00:00:00Z",
                },
                {
                  id: "demo2",
                  metric_id: "demo",
                  rating: 7,
                  date: "2024-03-07",
                  created_at: "2024-03-07T00:00:00Z",
                },
              ]}
              lastWeekEntries={[
                {
                  id: "demo3",
                  metric_id: "demo",
                  rating: 6,
                  date: "2024-03-03",
                  created_at: "2024-03-03T00:00:00Z",
                },
                {
                  id: "demo4",
                  metric_id: "demo",
                  rating: 7,
                  date: "2024-03-01",
                  created_at: "2024-03-01T00:00:00Z",
                },
              ]}
              onHelpClick={() => setTrendHelpMetricId("demo")}
            />

            <MetricInsightsCard
              metric={{ id: "demo", title: "Happiness", emoji: "😊" }}
              correlations={[
                {
                  activity: {
                    id: "exercise",
                    title: "Exercise",
                    emoji: "🏃‍♂️",
                  },
                  correlation: 0.75,
                },
                {
                  activity: {
                    id: "meditation",
                    title: "Meditation",
                    emoji: "🧘‍♂️",
                  },
                  correlation: 0.65,
                },
                {
                  activity: {
                    id: "gym",
                    title: "Gym",
                    emoji: "🏋️‍♂️",
                  },
                  correlation: -0.35,
                },
                {
                  activity: {
                    id: "reading",
                    title: "Reading",
                    emoji: "📚",
                  },
                  correlation: -0.05,
                },
              ]}
              onHelpClick={() => setHelpMetricId("demo")}
            />

            <TrendHelpPopover
              isOpen={trendHelpMetricId === "demo"}
              onClose={() => setTrendHelpMetricId(null)}
              metricTitle="Happiness"
            />

            <CorrelationHelpPopover
              isOpen={helpMetricId === "demo"}
              onClose={() => setHelpMetricId(null)}
              metricTitle="Happiness"
            />
          </div>
        </div>
        <div className="px-4 pb-10">
          <Button
            className={`w-full ${
              userPaidPlanType === "free"
                ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                : ""
            }`}
            onClick={() => {
              setAIMessage(
                "Great! Let's get started with a checkin. Just tell me how your day went!"
              );
              if (userPaidPlanType === "free") {
                setShowUpgradePopover(true);
              } else {
                addDefaultMetrics();
              }
            }}
          >
            {userPaidPlanType === "free" ? "Try the coaching freely" : "Start"}
          </Button>
        </div>
      </div>
    );
  }

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
            <h2 className="text-2xl font-bold">
              {specificMetric?.emoji} {specificMetric?.title}
            </h2>
            <p className="text-muted-foreground">
              {targetEntries === MINIMUM_ENTRIES
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
    const milestones = [MINIMUM_ENTRIES, 10, 15, 30, 45, 60, 90, 120];
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
    <div className="mx-auto p-6 max-w-2xl space-y-8">
      <div>
        <h3 className="text-lg font-semibold my-4">Check-ins</h3>
        <DailyCheckinViewer entries={entries} />
        <div className="mt-4">
          <DailyCheckinCard aiMessage={aiMessage} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold my-4">Metrics</h3>
        {/* <MetricSelector
        metrics={userMetrics}
        selectedMetricId={selectedMetricId}
        onMetricSelect={setSelectedMetricId}
      /> */}

        {/* <AddMetricPopover
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
      /> */}

        <div className="space-y-4">
          {userMetrics.map((metric) => {
            const count = entries.filter(
              (e) => e.metric_id === metric.id
            ).length;
            const correlations =
              count >= MINIMUM_ENTRIES
                ? calculateMetricCorrelations(metric.id)
                    .filter(
                      (c): c is { activity: Activity; correlation: number } =>
                        c !== null
                    )
                    .map((c) => ({
                      activity: c.activity,
                      correlation: c.correlation,
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
    </div>
  );
}
