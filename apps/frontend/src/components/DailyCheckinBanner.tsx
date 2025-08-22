import { useApiWithAuth } from "@/api";
import { useMutation } from "@tanstack/react-query";
import { ScanFace } from "lucide-react";
import { toast as hotToast } from "react-hot-toast";
import { EntryCard } from "./EntryCard";

import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import {
    useUserPlan,
} from "@/contexts/UserGlobalContext";
import { ActivityEntry, MetricEntry } from "@tsw/prisma";
import { formatDate } from "date-fns";
import AppleLikePopover from "./AppleLikePopover";
import {
    BaseExtractionResponse,
    DynamicUISuggester,
} from "./DynamicUISuggester";

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

export function DailyCheckinBanner({
  open,
  onClose,
  initialMessage,
}: {
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
}) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${hours % 12 || 12}:${minutes
    .toString()
    .padStart(2, "0")}${hours >= 12 ? "pm" : "am"}`;
  const isAfter4PM = hours >= 16;

  const { useMetricsAndEntriesQuery, useCurrentUserDataQuery } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserQuery;
  const user = userData;
  const activities = userData?.activities || [];
  const api = useApiWithAuth();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics;
  const aiMessage =
    initialMessage ||
    (isAfter4PM ? "How was your day?" : "How are you feeling today?");

  const { markAsSubmitted } = useDailyCheckin();

  function toAdjective(title: string) {
    switch (title) {
      case "Productivity":
        return "productive";
      case "Energy":
        return "energetic";
      case "Mood":
        return "happy";
      case "Happiness":
        return "happy";
      default:
        return "well";
    }
  }

  const metricsAdjectivString = metrics
    ?.map((m) => toAdjective(m.title))
    .join(" / ");

  const metricsString = metrics?.map((m) => m.title).join(" / ");

  const questionsChecks = {
    "what activities has the user done": {
      title: "What activities did you do",
    },
    ...metrics?.reduce(
      (acc, m, i, arr) => ({
        ...acc,
        [`wether the user mentioned their ${metricsString} metrics (out of 5)`]: {
          title: `How ${metricsAdjectivString} did you feel (out of 5), and why`,
        },
      }),
      {}
    ),
  };

  const logMetricMutation = useMutation({
    mutationFn: async (entry: MetricEntry) => {
      const response = await api.post("/metrics/log-metric", {
        metric_id: entry.metricId,
        rating: entry.rating,
        date: entry.date,
      });
      return response.data;
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (entry: ActivityEntry) => {
      const formData = new FormData();
      formData.append("activityId", entry.activityId);
      formData.append("iso_date_string", entry.date.toISOString());
      formData.append("quantity", entry.quantity.toString());

      const response = await api.post("/activities/log-activity", formData);
      return response.data;
    },
  });

  // Handle submission to the API
  const handleSubmit = async (
    text: string
  ): Promise<DailyCheckinExtractionsResponse> => {
    const response = await api.post(`/ai/get-daily-checkin-extractions`, {
      ai_message: aiMessage,
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
    markAsSubmitted();
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
    markAsSubmitted();
    onClose();
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
          {data.metric_entries.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <h2 className="text-md font-semibold text-left">Metrics</h2>
              <div className="flex flex-col gap-2">
                {data.metric_entries?.map((m) => {
                  const respectiveMetric = metrics?.find(
                    (metric) => metric.id === m.metricId
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
          )}

          {data.activity_entries.length > 0 && (
            <div className="flex flex-col gap-2 w-full">
              <h2 className="text-md font-semibold text-left">Activities</h2>
              <div className="flex flex-col gap-2">
                {data.activity_entries?.map((a) => {
                  const respectiveActivity = activities?.find(
                    (activity) => activity.id === a.activityId
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
          )}
        </div>
      </>
    );
  };

  return (
    <AppleLikePopover
      open={open}
      onClose={() => {
        onClose();
      }}
    >
      <DynamicUISuggester<DailyCheckinExtractionsResponse>
        id="daily-checkin"
        title={`Hey ${user?.username}! It's ${timeString}!`}
        initialMessage={aiMessage}
        questionPrefix="I'd like to know:"
        questionsChecks={questionsChecks}
        onSubmit={handleSubmit}
        renderChildren={renderExtractedData}
        onAccept={handleAccept}
        onReject={handleRejection}
        wave={true}
      />
    </AppleLikePopover>
  );
}
