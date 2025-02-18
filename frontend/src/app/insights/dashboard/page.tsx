"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useUserPlan,
  Metric,
  MetricEntry,
} from "@/contexts/UserPlanContext";
import Divider from "@/components/Divider";
import { Loader2, HelpCircle } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { CorrelationEntry } from "@/components/CorrelationEntry";
import { Button } from "@/components/ui/button";
import AppleLikePopover from "@/components/AppleLikePopover";

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation

const ratingColors = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
} as const;

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
  const [helpMetricId, setHelpMetricId] = useState<string | null>(null);

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

    return (
      <Card className="p-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">Building your insights</h2>
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

          return (
            <Card key={metric.id} className="p-8">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">
                      {metric.emoji} {metric.title} Insights
                    </h2>
                    <p className="text-muted-foreground">
                      Here&apos;s how your activities correlate with {metric.title.toLowerCase()}
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
                      title={`${correlation!.activity.emoji} ${correlation!.activity.title}`}
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
                  <h3 className="text-lg font-semibold">Understanding Pearson Correlation</h3>
                  
                  <p className="text-sm text-gray-600">
                    Pearson correlation measures how well two things move together, from -100% (perfect opposite) to +100% (perfect match).
                  </p>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Real Example:</p>
                    <p className="text-sm text-gray-600 mb-3">
                      Let&apos;s look at running activity and productivity over 7 days:
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
                            <th className="text-left py-2 pr-4">Productivity</th>
                            <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                            <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                            <td className={`px-3 font-medium ${ratingColors[5]}`}>5</td>
                            <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                            <td className={`px-3 font-medium ${ratingColors[2]}`}>2</td>
                            <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                            <td className={`px-3 font-medium ${ratingColors[4]}`}>4</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-4 text-sm">
                      A correlation of +60% means that about 60% of the time, when one value goes up, the other goes up too. Looking at the pattern above:
                    </p>
                    <ul className="mt-2 text-sm space-y-1 ml-4 list-disc">
                      <li>Running days usually mean higher productivity (<span className={ratingColors[4]}>4</span>-<span className={ratingColors[5]}>5</span>), but not always</li>
                      <li>Non-running days usually mean lower productivity (<span className={ratingColors[2]}>2</span>), but not always</li>
                      <li>The pattern matches about 60% of the time (4 out of 7 days follow the expected pattern)</li>
                    </ul>
                    <p className="mt-3 text-sm text-gray-600">
                      Think of it like this: if you see someone went running, you&apos;d have a 60% chance of correctly guessing they had higher productivity that day - better than random chance, but not a guarantee.
                    </p>
                  </div>

                  <div className="text-xs text-gray-500 mt-4">
                    Note: Correlations below 10% are shown in gray as they would only let you make correct predictions 10% of the time - barely better than random chance.
                  </div>
                </div>
              </AppleLikePopover>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
