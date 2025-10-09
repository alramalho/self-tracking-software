import Divider from "@/components/Divider";
import { MetricRater } from "@/components/MetricRater";
import { Card } from "@/components/ui/card";
import { useMetrics } from "@/contexts/metrics";
import { useCurrentUser } from "@/contexts/users";
import { todaysLocalDate } from "@/lib/utils";
import { type Metric } from "@tsw/prisma";
import { isToday } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";
import { DynamicUISuggester } from "./DynamicUISuggester";

interface MetricRating {
  rating: number;
}

export function MetricRaters({
  onAllRatingsSubmitted,
}: {
  onAllRatingsSubmitted: () => void;
}) {
  const { currentUser } = useCurrentUser();
  const { metrics, entries, logMetrics } = useMetrics();
  const user = currentUser;
  const [ratings, setRatings] = useState<Record<string, MetricRating>>({});

  const metricLoggingDisabled = (metric: Metric) => {
    const today = new Date().toISOString().split("T")[0];
    return entries?.some(
      (entry) =>
        entry.metricId === metric.id && isToday(entry.date)
    );
  };

  const handleRatingSelected = (metricId: string, rating: number) => {
    setRatings((prev) => ({
      ...prev,
      [metricId]: { rating },
    }));
  };

  const handleSubmitAllRatings = async (description: string) => {
    try {
      const ratingsToSubmit = Object.entries(ratings).map(([metricId, ratingData]) => ({
        metricId,
        rating: ratingData.rating,
        date: todaysLocalDate(),
        description,
      }));

      await logMetrics(ratingsToSubmit);
      
      // Clear ratings after successful submission
      setRatings({});
      onAllRatingsSubmitted();
    } catch (error) {
      console.error("Error submitting ratings:", error);
      toast.error("Failed to submit ratings");
    }
  };

  const hasUnloggedMetrics = metrics?.some(
    (metric) => !metricLoggingDisabled(metric)
  );
  const unloggedMetrics = metrics?.filter(
    (metric) => !metricLoggingDisabled(metric)
  );
  const allMetricsRated =
    hasUnloggedMetrics && unloggedMetrics?.every((metric) => ratings[metric.id]);

  return (
    <div className="space-y-8">
      {metrics?.map((metric) => {
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
              canSubmit={() => true}
              submitButtonText="Submit"
              wave={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
