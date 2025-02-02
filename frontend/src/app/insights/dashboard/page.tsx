"use client";

import { useApiWithAuth } from "@/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useState } from "react";
import { MetricRater } from "@/components/MetricRater";
import { Router } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MetricEntry {
  id: string;
  metric_id: string;
  rating: number;
  created_at: string;
}

interface Metric {
  id: string;
  title: string;
  emoji: string;
}

export default function InsightsDashboardPage() {
  const api = useApiWithAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const metricLoggingDisabled = (metric: Metric) => {
    return entries.some(
      (entry) =>
        entry.metric_id === metric.id &&
        entry.created_at.split("T")[0] ===
          new Date().toISOString().split("T")[0]
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsResponse, entriesResponse] = await Promise.all([
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

  // If no metric has 15+ entries, show the progress UI
  if (maxEntries < 15) {
    return (
      <div className="container mx-auto py-10 max-w-3xl space-y-8">
        <Card className="p-8">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Building your insights</h2>
              <p className="text-muted-foreground">
                We need more data to generate meaningful insights. Keep logging
                your metrics daily!
              </p>
            </div>

            <div className="space-y-4">
              {metricEntryCounts.map(({ metric, count }) => {
                const progressPercent = (count / 15) * 100;
                return (
                  <div key={metric.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        {metric.emoji} {metric.title}
                      </span>
                      <span className="text-muted-foreground">
                        {count} / 15 entries
                      </span>
                    </div>
                    <Progress
                      value={progressPercent}
                      className="h-2"
                      indicatorColor="bg-blue-500"
                    />
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      {15 - count} more entries needed for insights
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

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
                  You have already logged your {metric.title} today.{" "}
                  <Link href="/ai" className="underline pointer-events-auto">
                    Notify me tomorrow
                  </Link>
                </p>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  // TODO: Render actual insights when we have enough data
  return null;
}
