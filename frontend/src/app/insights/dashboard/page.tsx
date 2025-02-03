"use client";

import { useApiWithAuth } from "@/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useState } from "react";
import { MetricRater } from "@/components/MetricRater";
import { Router } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CorrelationEntry } from "@/components/CorrelationEntry";
import { useUserPlan } from "@/contexts/UserPlanContext";

interface MetricEntry {
  id: string;
  metric_id: string;
  rating: number;
  date: string;
  created_at: string;
}

interface Metric {
  id: string;
  title: string;
  emoji: string;
}

// Configuration constants
const ACTIVITY_WINDOW_DAYS = 1; // How many days to look back for activity correlation

export default function InsightsDashboardPage() {
  const api = useApiWithAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const activities = userData?.activities || [];
  const activityEntries = userData?.activityEntries || [];
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const metricLoggingDisabled = (metric: Metric) => {
    return entries.some(
      (entry) =>
        entry.metric_id === metric.id &&
        entry.date.split("T")[0] ===
          new Date().toISOString().split("T")[0]
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsResponse, entriesResponse,] = await Promise.all([
          api.get("/metrics"),
          api.get("/metric-entries"),
        ]);
        setMetrics(metricsResponse.data);
        setEntries(entriesResponse.data);
        if (metricsResponse.data.length == 0) {
          router.push("/insights");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRatingSubmitted = () => {
    // Refresh entries
    api.get("/metric-entries").then((response) => setEntries(response.data));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-10 max-w-3xl">
        <Card className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-secondary rounded w-3/4"></div>
            <div className="h-4 bg-secondary rounded w-1/2"></div>
          </div>
        </Card>
      </div>
    );
  }

  // Find the metric with the most entries
  const metricEntryCounts = metrics.map((metric) => ({
    metric,
    count: entries.filter((entry) => entry.metric_id === metric.id).length,
  }));
  const maxEntries = Math.max(...metricEntryCounts.map((m) => m.count));

  // Calculate Pearson correlation between two arrays
  const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sum1 = x.reduce((a, b) => a + b);
    const sum2 = y.reduce((a, b) => a + b);
    const sum1Sq = x.reduce((a, b) => a + b * b);
    const sum2Sq = y.reduce((a, b) => a + b * b);
    const pSum = x.reduce((a, b, i) => a + b * y[i], 0);

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    return den === 0 ? 0 : num / den;
  };

  // Check if an activity happened within the configured window before a date
  const activityHappenedWithinWindow = (activityId: string, date: string): boolean => {
    const targetDate = new Date(date);
    const windowStart = new Date(targetDate);
    windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

    const result = activityEntries.some(entry => {
      const entryDate = new Date(entry.date);
      return entry.activity_id === activityId && 
             entryDate >= windowStart && 
             entryDate <= targetDate;
    });
    return result;
  };

  // Calculate correlations for a metric
  const calculateMetricCorrelations = (metricId: string) => {
    const metricEntries = entries
      .filter(entry => entry.metric_id === metricId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const correlations = activities.map(activity => {
      const binaryActivityArray = metricEntries.map(entry => {
        const didActivity = activityHappenedWithinWindow(activity.id, entry.date);
        console.log(`Activity ${activity.title} happened within ${ACTIVITY_WINDOW_DAYS} days of ${entry.date}:`, didActivity);
        return didActivity ? 1 : 0;
      });

      // Only calculate correlation if the activity has some occurrences
      if (binaryActivityArray.some(v => v === 1)) {
        const ratings = metricEntries.map(e => e.rating);
        const correlation = calculatePearsonCorrelation(ratings, binaryActivityArray);
        return {
          activity,
          correlation
        };
      }
      return null;
    }).filter(Boolean);

    // Sort by absolute correlation value
    return correlations.sort((a, b) => Math.abs(b!.correlation) - Math.abs(a!.correlation));
  };

  // If no metric has 15+ entries, show the progress UI
  const renderProgressUI = (targetEntries: number) => (
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

        <div className="space-y-4">
          {metricEntryCounts.map(({ metric, count }) => {
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
                  indicatorColor="bg-blue-500"
                />
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {targetEntries - count} more entries needed for stronger correlation analysis
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

  const renderMetricRaters = () => (
    <>
      {metrics.map((metric) => {
        const isDisabled = metricLoggingDisabled(metric);
        return (
          <Card
            key={metric.id}
            className={`p-8 ${
              isDisabled ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <MetricRater
              metricId={metric.id}
              metricTitle={metric.title}
              metricEmoji={metric.emoji}
              onRatingSubmitted={handleRatingSubmitted}
            />

            {isDisabled && (
              <p className="text-sm text-black italic mt-4">
                ✅ You have already logged your {metric.title} today.{" "}
              </p>
            )}
          </Card>
        );
      })}
    </>
  );

  if (maxEntries < 15) {
    return (
      <div className="container mx-auto py-10 max-w-3xl space-y-8">
        {renderProgressUI(15)}
        {renderMetricRaters()}
      </div>
    );
  }

  // Calculate next milestone based on current entries
  const getNextMilestone = (entries: number) => {
    const milestones = [15, 30, 45, 60, 90, 120];
    return milestones.find(m => entries < m) || milestones[milestones.length - 1];
  };

  // Render insights when we have enough data
  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      {metrics.map(metric => {
        const metricEntryCount = entries.filter(e => e.metric_id === metric.id).length;
        if (metricEntryCount >= 15) {
          const correlations = calculateMetricCorrelations(metric.id);
          if (correlations.length > 0) {
            return (
              <Card key={metric.id} className="p-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">
                      {metric.emoji} {metric.title} Insights
                    </h2>
                    <p className="text-muted-foreground">
                      Here&apos;s how your activities correlate with your {metric.title.toLowerCase()}:
                    </p>
                  </div>
                  <div className="space-y-4">
                    {correlations.map(correlation => (
                      <CorrelationEntry
                        key={correlation!.activity.id}
                        title={`${correlation!.activity.emoji} ${correlation!.activity.title}`}
                        pearsonValue={correlation!.correlation}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            );
          }
        }
        return null;
      })}

      {/* Show progress UI for next milestone if no correlations are found */}
      {!metrics.some(metric => {
        const count = entries.filter(e => e.metric_id === metric.id).length;
        const correlations = count >= 15 ? calculateMetricCorrelations(metric.id) : [];
        return correlations.length > 0;
      }) && renderProgressUI(getNextMilestone(maxEntries))}

      {/* Always show metric raters at the bottom */}
      {renderMetricRaters()}
    </div>
  );
}
