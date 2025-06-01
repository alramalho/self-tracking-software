import React, { useEffect, useState } from "react";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "./DynamicUISuggester";
import { toast } from "sonner";
import { useApiWithAuth } from "@/api";
import {
  Activity,
  ActivityEntry,
  ApiPlan,
  PlanMilestone,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { EntryCard } from "./EntryCard";
import { useMutation } from "@tanstack/react-query";
import { Description } from "@radix-ui/react-alert-dialog";

// Interface for plan extraction response
interface PastWeekLoggingResponse extends BaseExtractionResponse {
  activities?: Activity[];
  activity_entries?: ActivityEntry[];
  question_checks: Record<string, boolean>;
  message: string;
}

export function PastWeekLoggingDynamicUI({ onNext }: { onNext: () => void }) {
  const api = useApiWithAuth();
  const [text, setText] = useState("");
  const [shouldRenderChildren, setShouldRenderChildren] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const activities = userData?.activities ?? [];

  useEffect(() => {
    if (activities.length === 0) {
      onNext();
    }
  }, [activities, onNext]);

  const initialAIMessage = "What did you do recently?";

  // Track which plan steps we've identified in the text
  const questionChecks = {
    "Does the user mentions which activities did they do recently?": {
      title: "Which activities did you do?",
      description: "Reading, running, etc.",
    },
    "For every mentioned activity, does the user mention the date or day of the week that the activity was done? (If there are no activities then consider this to be irrelvant, and just return true to validate)": {
      title: "When did you do them?",
      description: "Monday, tuesday, etc (can also be an estimation)",
    },
    "For every mentioned activity, does the user mention the quantity (pages / km / etc) of the activity they did? (If there are no activities then consider this to be irrelvant, and just return true to validate)": {
      title: "Their 'quantity'",
      description: "10 pages, 3 km, 90 minutes, etc",
    },
  };

  // Submit text to AI for plan extraction
  const handleSubmit = async (
    text: string
  ): Promise<PastWeekLoggingResponse> => {
    setText(text);
    try {
      const response = await api.post("/ai/get-past-week-logging-extractions", {
        ai_message: initialAIMessage,
        message: text,
        question_checks: questionChecks,
      });

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };

  const logActivityMutation = useMutation({
    mutationFn: async (entry: ActivityEntry) => {
      const formData = new FormData();
      formData.append("activity_id", entry.activity_id);
      formData.append("iso_date_string", entry.date);
      formData.append("quantity", entry.quantity.toString());
      formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);

      const response = await api.post("/log-activity", formData);
      return response.data;
    },
  });

  // Handle plan acceptance - uses the plans.py /create-plan endpoint
  const handleAccept = async (data: PastWeekLoggingResponse): Promise<void> => {
    try {
      for (const activity_entry of data.activity_entries ?? []) {
        await logActivityMutation.mutateAsync(activity_entry);
      }

      currentUserDataQuery.refetch();
      onNext();
      toast.success("Activity entries logged successfully!");
    } catch (error) {
      console.error("Error logging activity entries:", error);
      toast.error("Failed to log activity entries. Please try again.");
      throw error;
    }
  };

  // Handle plan rejection - just log to Telegram
  const handleReject = async (
    feedback: string,
    data: PastWeekLoggingResponse
  ): Promise<void> => {
    try {
      await api.post("/ai/reject-past-week-logging", {
        feedback,
        activities: data.activities,
        activity_entries: data.activity_entries,
        user_message: text,
        ai_message: data.message,
      });
      toast.success(
        "Feedback submitted. Our team was alerted. Let's try again later"
      );
    } catch (error) {
      console.error("Error rejecting plan:", error);
      toast.error("Failed to submit feedback. Please try again.");
      throw error;
    }
  };

  // Render the extracted plan data, inspired by PlanBuildingContainer
  const renderExtractedData = (data: PastWeekLoggingResponse) => {
    if (!data.activity_entries) {
      setShouldRenderChildren(false);
      return null;
    }
    setShouldRenderChildren(true);

    return (
      <div className="space-y-4">
        {data.activity_entries.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            <h2 className="text-md font-semibold text-left">Activities</h2>
            <div className="flex flex-col gap-2">
              {data.activity_entries?.map((a) => {
                const respectiveActivity = userData?.activities?.find(
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
        )}
      </div>
    );
  };

  function renderIntermediateComponents() {
    return (
      <div className="flex flex-col gap-2 w-full">
        <h2 className="text-sm font-normal text-left text-gray-500">
          Your existing activities
        </h2>

        <div className="flex flex-row flex-wrap gap-2">
          {activities.map((a) => (
            <EntryCard
              key={a.id}
              emoji={a.emoji || ""}
              title={a.title}
              description={a.measure}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DynamicUISuggester<PastWeekLoggingResponse>
      id="past-week-logging"
      title="Let's log you some activities!"
      initialMessage={initialAIMessage}
      placeholder="For example: this week I ran 4km on monday and read 20 pages of my book yesterday."
      questionPrefix="In order for me to properly log them for you, I need to know:"
      creationMessage="Do you want me to create these activities and entries for you? (You can edit them later)"
      questionsChecks={questionChecks}
      onSubmit={handleSubmit}
      onAccept={handleAccept}
      onReject={handleReject}
      onSkip={() => {
        onNext();
      }}
      shouldRenderChildren={shouldRenderChildren}
      renderChildren={renderExtractedData}
      renderIntermediateComponents={renderIntermediateComponents}
    />
  );
}
