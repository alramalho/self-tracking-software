import { Card } from "@/components/ui/card";
import { MetricRater } from "@/components/MetricRater";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Metric } from "@/contexts/UserPlanContext";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import Divider from "@/components/Divider";
import { DynamicUISuggester } from "./DynamicUISuggester";

interface MetricRating {
  rating: number;
}

export function MetricRaters({
  onAllRatingsSubmitted,
}: {
  onAllRatingsSubmitted: () => void;
}) {
  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const user = userData?.user;
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics || [];
  const entries = metricsAndEntriesData?.entries || [];
  const [ratings, setRatings] = useState<Record<string, MetricRating>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApiWithAuth();

  const metricLoggingDisabled = (metric: Metric) => {
    const today = new Date().toISOString().split("T")[0];
    return entries.some(
      (entry) =>
        entry.metric_id === metric.id && entry.date.split("T")[0] === today
    );
  };

  const handleRatingSelected = (metricId: string, rating: number) => {
    setRatings((prev) => ({
      ...prev,
      [metricId]: { rating },
    }));
  };

  const handleSubmitAllRatings = async (description: string) => {
    setIsSubmitting(true);
    try {
      // Submit all ratings in sequence with the same description
      for (const [metricId, ratingData] of Object.entries(ratings)) {
        await api.post("/log-metric", {
          metric_id: metricId,
          rating: ratingData.rating,
          description,
        });
      }

      toast.success("All ratings submitted successfully");
      metricsAndEntriesQuery.refetch();
      // Clear ratings and description after successful submission
      setRatings({});
      onAllRatingsSubmitted();
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUnloggedMetrics = metrics.some(
    (metric) => !metricLoggingDisabled(metric)
  );
  const unloggedMetrics = metrics.filter(
    (metric) => !metricLoggingDisabled(metric)
  );
  const allMetricsRated =
    hasUnloggedMetrics && unloggedMetrics.every((metric) => ratings[metric.id]);

  return (
    <div className="space-y-8">
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
              onRatingSelected={handleRatingSelected}
            />

            {isDisabled && (
              <p className="text-sm text-black italic mt-4">
                ✅ You have already logged your {metric.title} today.{" "}
              </p>
            )}
          </Card>
        );
      })}

      {hasUnloggedMetrics && (
        <>
          <Divider />
          <div
            className={`space-y-4 transition-opacity duration-200 ${
              allMetricsRated ? "opacity-100" : "opacity-50"
            }`}
          >
            <DynamicUISuggester
              id="daily-checkin"
              title={`Why these ratings ${user?.name}?`}
              description="This will help me understand you better"
              onSubmit={async (description) => {
                await handleSubmitAllRatings(description);
              }}
              canSubmitEmpty={true}
              submitButtonText="Submit"
              wave={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
