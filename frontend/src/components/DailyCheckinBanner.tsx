import { ScanFace } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { toast as hotToast } from "react-hot-toast";
import { EntryCard } from "./EntryCard";

import {
  ActivityEntry,
  MetricEntry,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { useState } from "react";
import { formatDate } from "date-fns";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "./DynamicUISuggester";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import AppleLikePopover from "./AppleLikePopover";

export const getRelativeDate = (date: Date) => {
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date, "MMM d, yyyy");
};

// Define the type for the API response
interface DailyCheckinExtractionsResponse extends BaseExtractionResponse {
  metric_entries: MetricEntry[];
  activity_entries: ActivityEntry[];
  question_checks: Record<string, boolean>;
  message: string;
}

export function DailyCheckinBanner() {
  const now = new Date();
  const hours = now.getHours();
  const isAfter4PM = hours >= 16;

  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserQuery;
  const activities = userData?.activities || [];
  const api = useApiWithAuth();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics;

  const [lastInteractionDatetime, setLastInteractionDatetime] = useLocalStorage<
    string | null
  >("lastCheckinDatetime", null);

  const [open, setIsOpen] = useState(() => {
    if (!lastInteractionDatetime) return true;
    const lastInteraction = new Date(lastInteractionDatetime);
    const today = new Date();
    return lastInteraction.toDateString() !== today.toDateString();
  });

  const questionsChecks = {
    ...metrics?.reduce(
      (acc, m) => ({
        ...acc,
        [`Your ${m.title} today on a scale of 1-5`]: `the user mentioned their ${m.title} metric`,
      }),
      {}
    ),
    "what have you done today (and for how long)":
      "what has the user done today",
  };

  const logMetricMutation = useMutation({
    mutationFn: async (entry: MetricEntry) => {
      const response = await api.post("/log-metric", {
        metric_id: entry.metric_id,
        rating: entry.rating,
        date: entry.date,
      });
      return response.data;
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (entry: ActivityEntry) => {
      const formData = new FormData();
      formData.append("activity_id", entry.activity_id);
      formData.append("iso_date_string", entry.date);
      formData.append("quantity", entry.quantity.toString());

      const response = await api.post("/log-activity", formData);
      return response.data;
    },
  });

  // Handle submission to the API
  const handleSubmit = async (
    text: string
  ): Promise<DailyCheckinExtractionsResponse> => {
    const response = await api.post(`/ai/get-daily-checkin-extractions`, {
      message: text,
      question_checks: questionsChecks,
    });
    return response.data;
  };

  // Handle accept action
  const handleAccept = async (
    data: DailyCheckinExtractionsResponse
  ): Promise<void> => {
    // Log all metric entries
    await Promise.all(
      data.metric_entries.map((entry) => logMetricMutation.mutateAsync(entry))
    );

    // Log all activity entries
    await Promise.all(
      data.activity_entries.map((entry) =>
        logActivityMutation.mutateAsync(entry)
      )
    );

    // Refresh the queries to get updated data
    metricsAndEntriesQuery.refetch();
    currentUserQuery.refetch();

    hotToast.success("Daily checkin done! Come back tomorrow!");
  };

  // Handle rejection action
  const handleRejection = async (
    feedback: string,
    data: DailyCheckinExtractionsResponse
  ): Promise<void> => {
    await api.post("/ai/reject-daily-checkin", {
      message: data.message,
      activity_entries: data.activity_entries,
      metric_entries: data.metric_entries,
      rejection_feedback: feedback,
    });

    hotToast.success("Thank you for your input. We'll do better next time!");
    setLastInteractionDatetime(new Date().toISOString());
    setIsOpen(false);
  };

  // Render the extracted data
  const renderExtractedData = (data: DailyCheckinExtractionsResponse) => {
    return (
      <>
        <p className="text-sm text-gray-500 text-left w-full px-4 mt-4">
          <div className="text-sm text-gray-500 mt-8 text-left w-full mt-4">
            <p className="flex flex-row gap-2">
              <ScanFace size={24} />
              I&apos;ve extracted the following data from your message
            </p>
          </div>
        </p>
        <div className="flex flex-row no-wrap justify-around mt-4">
          <div className="flex flex-col gap-2">
            {data.metric_entries.length > 0 && (
              <h2 className="text-md font-semibold text-left">Metrics</h2>
            )}
            <div className="flex flex-col gap-2">
              {data.metric_entries?.map((m) => {
                const respectiveMetric = metrics?.find(
                  (metric) => metric.id === m.metric_id
                );
                return (
                  <div key={m.id}>
                    <EntryCard
                      emoji={respectiveMetric?.emoji || ""}
                      title={respectiveMetric?.title || ""}
                      description={`${m.rating} / 5`}
                      date={new Date(m.date)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {data.activity_entries.length > 0 && (
              <h2 className="text-md font-semibold text-left">Activities</h2>
            )}
            <div className="flex flex-col gap-2">
              {data.activity_entries?.map((a) => {
                const respectiveActivity = activities?.find(
                  (activity) => activity.id === a.activity_id
                );
                return (
                  <div key={a.id}>
                    <EntryCard
                      emoji={respectiveActivity?.emoji || ""}
                      title={respectiveActivity?.title || ""}
                      description={`${a.quantity} ${respectiveActivity?.measure}`}
                      date={new Date(a.date)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <AppleLikePopover
      open={open}
      onClose={() => {
        setLastInteractionDatetime(new Date().toISOString());
        setIsOpen(false);
      }}
    >
      <DynamicUISuggester<DailyCheckinExtractionsResponse>
        initialMessage={
          isAfter4PM ? "How was your day?" : "How are you feeling today?"
        }
        questionsChecks={questionsChecks}
        onSubmit={handleSubmit}
        renderChildren={renderExtractedData}
        onAccept={handleAccept}
        onReject={handleRejection}
        title="Daily checkin time! 😊"
      />
    </AppleLikePopover>
  );
}
