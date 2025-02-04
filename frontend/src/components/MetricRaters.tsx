import { Card } from "@/components/ui/card";
import { MetricRater } from "@/components/MetricRater";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Metric } from "@/contexts/UserPlanContext";

export function MetricRaters() {
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];

  const metricLoggingDisabled = (metric: Metric) => {
    const today = new Date().toISOString().split('T')[0];
    return entries.some(
      (entry) =>
        entry.metric_id === metric.id &&
        entry.date.split("T")[0] === today
    );
  };

  const handleRatingSubmitted = () => {
    metricsAndEntriesQuery.refetch();
  };

  return (
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
} 