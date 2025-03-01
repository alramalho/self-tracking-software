"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserPlan, Metric, MetricEntry } from "@/contexts/UserPlanContext";
import {
  Loader2,
  HelpCircle,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { CorrelationEntry } from "@/components/CorrelationEntry";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";
import { useQuery } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import AINotification from "@/components/AINotification";
import { toast } from "react-hot-toast";
import { defaultMetrics } from "../onboarding/page";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

interface AIMessageResponse {
  message: string;
}

export default function InsightsDashboardPage() {
  const {
    useCurrentUserDataQuery,
    useMetricsAndEntriesQuery,
    useHasMetricsToLogToday,
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
  const api = useApiWithAuth();
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [isAddMetricOpen, setIsAddMetricOpen] = useState(false);
  const [selectedNewMetric, setSelectedNewMetric] = useState<string | null>(
    null
  );
  const [isCreatingMetric, setIsCreatingMetric] = useState(false);

  const { data: aiMessageData } = useQuery<AIMessageResponse>({
    queryKey: ["metrics-dashboard-message"],
    queryFn: async () => {
      const response = await api.get("/ai/generate-metrics-dashboard-message");
      return response.data;
    },
  });

  useEffect(() => {
    if (aiMessageData?.message) {
      setAiMessage(aiMessageData.message);
      setShouldShowNotification(true);
    }
  }, [aiMessageData]);

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

  const handleAddMetric = async () => {
    if (!selectedNewMetric) return;

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
      {shouldShowNotification && (
        <AINotification
          message={aiMessage}
          createdAt={new Date().toISOString()}
          onDismiss={() => setShouldShowNotification(false)}
          onClick={() => {
            setShouldShowNotification(false);
            router.push("/ai?assistantType=metrics-companion");
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          {userMetrics.map((metric) => (
            <Button
              key={metric.id}
              variant={selectedMetricId === metric.id ? "default" : "outline"}
              onClick={() => setSelectedMetricId(metric.id)}
              className="flex items-center gap-2"
            >
              <span>{metric.emoji}</span>
              <span>{metric.title}</span>
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsAddMetricOpen(true)}
          className="ml-2"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <AppleLikePopover
        open={isAddMetricOpen}
        onClose={() => {
          setIsAddMetricOpen(false);
          setSelectedNewMetric(null);
        }}
        title="Add New Metric"
      >
        <div className="pt-8 space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Add a new metric</h1>
            <p className="text-md text-muted-foreground">
              Select a metric you&apos;d like to track and correlate with your
              activities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {defaultMetrics
              .filter(
                (m) =>
                  !metricsAndEntriesData?.metrics.some(
                    (existing) => existing.title === m.title
                  )
              )
              .map((metric) => (
                <Card
                  key={metric.title}
                  className={`p-6 transition-all cursor-pointer ${
                    selectedNewMetric === metric.title
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setSelectedNewMetric(metric.title)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{metric.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-lg">{metric.title}</h3>
                    </div>
                  </div>
                </Card>
              ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="w-full max-w-sm"
              disabled={!selectedNewMetric || isCreatingMetric}
              onClick={handleAddMetric}
              loading={isCreatingMetric}
            >
              Add Metric
            </Button>
          </div>
        </div>
      </AppleLikePopover>

      <div className="space-y-4">
        {userMetrics
          .filter((metric) => metric.id === selectedMetricId)
          .map((metric) => {
            const count = entries.filter(
              (e) => e.metric_id === metric.id
            ).length;
            const correlations =
              count >= 15 ? calculateMetricCorrelations(metric.id) : [];
            const hasCorrelations = correlations.length > 0;
            const chartData = prepareChartData(metric.id);
            const trend = calculateMetricTrend(
              entries.filter((e) => e.metric_id === metric.id)
            );
            const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
            const trendColor = trend >= 0 ? "text-green-500" : "text-red-500";

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
                {/* Metric Trend Card */}
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-row justify-between items-center gap-2 w-full">
                      <span className="text-4xl">{metric.emoji}</span>
                      <div className="flex flex-col items-start justify-between w-full">
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-left">
                            <span className="text-lg">
                              {metric.title} Trend
                            </span>{" "}
                          </h2>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-row justify-between items-center gap-2 w-full">
                            <div
                              className={`flex items-center gap-1 text-sm ${trendColor}`}
                            >
                              <TrendIcon className="h-4 w-4" />
                              {Math.abs(trend).toFixed(1)}%
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Last 14 days
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => setTrendHelpMetricId(metric.id)}
                      >
                        <HelpCircle className="h-5 w-5" />
                      </Button>
                    </div>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      <li>
                        This week&apos;s avg:{" "}
                        <span className="font-bold font-mono">
                          {thisWeekEntries.length > 0
                            ? thisWeekAvg.toFixed(2)
                            : "No data"}
                        </span>
                      </li>
                      <li>
                        Last week&apos;s avg:{" "}
                        <span className="font-bold font-mono">
                          {lastWeekEntries.length > 0
                            ? lastWeekAvg.toFixed(2)
                            : "No data"}
                        </span>
                      </li>
                    </ul>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={12}
                            stroke="#888888"
                          />
                          <YAxis
                            domain={[1, 5]}
                            ticks={[1, 2, 3, 4, 5]}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={12}
                            stroke="#888888"
                          />
                          <Tooltip
                            contentStyle={{
                              background: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rating"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={{
                              fill: "#22c55e",
                              r: 4,
                            }}
                            activeDot={{
                              r: 6,
                              fill: "#22c55e",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <AppleLikePopover
                    open={trendHelpMetricId === metric.id}
                    onClose={() => setTrendHelpMetricId(null)}
                    title="Understanding Trends"
                  >
                    <div className="pt-8 space-y-4 mb-4">
                      <h3 className="text-lg font-semibold">
                        Understanding Your {metric.title} Trend
                      </h3>

                      <p className="text-sm text-gray-600">
                        The trend compares your average{" "}
                        {metric.title.toLowerCase()} from this week against last
                        week, showing how things are changing.
                      </p>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">
                          Real Example:
                        </p>
                        <p className="text-sm text-gray-600 mb-3">
                          Let&apos;s look at someone&apos;s{" "}
                          {metric.title.toLowerCase()} ratings over two weeks:
                        </p>
                        <div className="space-y-6">
                          {/* Last Week */}
                          <div>
                            <p className="text-sm font-medium mb-2">
                              Last Week:
                            </p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <tbody>
                                  <tr className="border-b">
                                    <th className="text-left pb-2 pr-4">Day</th>
                                    <td className="px-3">Mon</td>
                                    <td className="px-3">Tue</td>
                                    <td className="px-3">Wed</td>
                                    <td className="px-3">Thu</td>
                                    <td className="px-3">Fri</td>
                                    <td className="px-3">Sat</td>
                                    <td className="px-3">Sun</td>
                                  </tr>
                                  <tr>
                                    <th className="text-left py-2 pr-4">
                                      Rating
                                    </th>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[2]}`}
                                    >
                                      2
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[3]}`}
                                    >
                                      3
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[2]}`}
                                    >
                                      2
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[3]}`}
                                    >
                                      3
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[3]}`}
                                    >
                                      3
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[2]}`}
                                    >
                                      2
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[3]}`}
                                    >
                                      3
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              <p className="text-sm mt-2">
                                Last week&apos;s average:{" "}
                                <span className="font-medium">2.57</span>
                              </p>
                            </div>
                          </div>

                          {/* This Week */}
                          <div>
                            <p className="text-sm font-medium mb-2">
                              This Week:
                            </p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <tbody>
                                  <tr className="border-b">
                                    <th className="text-left pb-2 pr-4">Day</th>
                                    <td className="px-3">Mon</td>
                                    <td className="px-3">Tue</td>
                                    <td className="px-3">Wed</td>
                                    <td className="px-3">Thu</td>
                                    <td className="px-3">Fri</td>
                                    <td className="px-3">Sat</td>
                                    <td className="px-3">Sun</td>
                                  </tr>
                                  <tr>
                                    <th className="text-left py-2 pr-4">
                                      Rating
                                    </th>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[3]}`}
                                    >
                                      3
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[4]}`}
                                    >
                                      4
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[4]}`}
                                    >
                                      4
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[5]}`}
                                    >
                                      5
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[4]}`}
                                    >
                                      4
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[4]}`}
                                    >
                                      4
                                    </td>
                                    <td
                                      className={`px-3 font-medium ${ratingColors[4]}`}
                                    >
                                      4
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              <p className="text-sm mt-2">
                                This week&apos;s average:{" "}
                                <span className="font-medium">4.00</span>
                              </p>
                            </div>
                          </div>

                          {/* Calculation */}
                          <div className="mt-6 p-3 bg-white rounded border">
                            <p className="text-sm font-medium mb-2">
                              Trend Calculation:
                            </p>
                            <div className="space-y-2 text-sm">
                              <p>1. This week&apos;s average: 4.00</p>
                              <p>2. Last week&apos;s average: 2.57</p>
                              <p>
                                3. Calculation: ((4.00 - 2.57) / 2.57) × 100
                              </p>
                              <p className="font-medium text-green-500">
                                Result: +55.6% increase
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">
                            Understanding the Trend %:
                          </p>
                          <ul className="text-sm space-y-1 ml-4 list-disc">
                            <li className="text-green-500">
                              Positive % (↗️): This week&apos;s average is
                              higher than last week
                            </li>
                            <li className="text-red-500">
                              Negative % (↘️): This week&apos;s average is lower
                              than last week
                            </li>
                            <li className="text-gray-600">
                              The percentage shows how much better or worse this
                              week is compared to last week
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mt-4">
                        Tip: Click on any dot to see the exact rating for that
                        day.
                      </div>
                    </div>
                  </AppleLikePopover>
                </Card>

                {/* Insights Card */}
                <Card className="p-6">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex flex-row items-center gap-2">
                          <span className="text-4xl">{metric.emoji}</span>
                          <h2 className="text-lg font-bold">
                            {metric.title} Insights
                          </h2>
                        </div>
                        <p className="text-muted-foreground">
                          Here&apos;s how your activities correlate with{" "}
                          {metric.title.toLowerCase()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => setHelpMetricId(metric.id)}
                      >
                        <HelpCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {correlations.map((correlation) => (
                        <CorrelationEntry
                          key={correlation!.activity.id}
                          title={`${correlation!.activity.emoji} ${
                            correlation!.activity.title
                          }`}
                          pearsonValue={correlation!.correlation}
                        />
                      ))}
                    </div>
                  </div>

                  <AppleLikePopover
                    open={helpMetricId === metric.id}
                    onClose={() => setHelpMetricId(null)}
                    title="Understanding Correlation"
                  >
                    <div className="pt-8 space-y-4 mb-4">
                      <h3 className="text-lg font-semibold">
                        Understanding Pearson Correlation
                      </h3>

                      <p className="text-sm text-gray-600">
                        Pearson correlation measures how well two things move
                        together, from -100% (perfect opposite) to +100%
                        (perfect match).
                      </p>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">
                          Real Example:
                        </p>
                        <p className="text-sm text-gray-600 mb-3">
                          Let&apos;s look at running activity and productivity
                          over 7 days:
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <tbody>
                              <tr className="border-b">
                                <th className="text-left pb-2 pr-4">Day</th>
                                <td className="px-3">1</td>
                                <td className="px-3">2</td>
                                <td className="px-3">3</td>
                                <td className="px-3">4</td>
                                <td className="px-3">5</td>
                                <td className="px-3">6</td>
                                <td className="px-3">7</td>
                              </tr>
                              <tr>
                                <th className="text-left py-2 pr-4">Running</th>
                                <td className="px-3">✅</td>
                                <td className="px-3">❌</td>
                                <td className="px-3">✅</td>
                                <td className="px-3">✅</td>
                                <td className="px-3">❌</td>
                                <td className="px-3">✅</td>
                                <td className="px-3">❌</td>
                              </tr>
                              <tr>
                                <th className="text-left py-2 pr-4">
                                  Productivity
                                </th>
                                <td
                                  className={`px-3 font-medium ${ratingColors[4]}`}
                                >
                                  4
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[2]}`}
                                >
                                  2
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[5]}`}
                                >
                                  5
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[2]}`}
                                >
                                  2
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[2]}`}
                                >
                                  2
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[4]}`}
                                >
                                  4
                                </td>
                                <td
                                  className={`px-3 font-medium ${ratingColors[4]}`}
                                >
                                  4
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-4 text-sm">
                          A correlation of +60% means that about 60% of the
                          time, when one value goes up, the other goes up too.
                          Looking at the pattern above:
                        </p>
                        <ul className="mt-2 text-sm space-y-1 ml-4 list-disc">
                          <li>
                            Running days usually mean higher productivity (
                            <span className={ratingColors[4]}>4</span>-
                            <span className={ratingColors[5]}>5</span>), but not
                            always
                          </li>
                          <li>
                            Non-running days usually mean lower productivity (
                            <span className={ratingColors[2]}>2</span>), but not
                            always
                          </li>
                          <li>
                            The pattern matches about 60% of the time (4 out of
                            7 days follow the expected pattern)
                          </li>
                        </ul>
                        <p className="mt-3 text-sm text-gray-600">
                          Think of it like this: if you see someone went
                          running, you&apos;d have a 60% chance of correctly
                          guessing they had higher productivity that day -
                          better than random chance, but not a guarantee.
                        </p>
                      </div>

                      <div className="text-xs text-gray-500 mt-4">
                        Note: Correlations below 10% are shown in gray as they
                        would only let you make correct predictions 10% of the
                        time - barely better than random chance.
                      </div>
                    </div>
                  </AppleLikePopover>
                </Card>
              </div>
            );
          })}
      </div>
    </div>
  );
}
