import React, { useEffect, useState } from "react";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "./DynamicUISuggester";
import { toast } from "sonner";
import { useApiWithAuth } from "@/api";
import { Activity, ApiPlan, PlanMilestone, useUserPlan } from "@/contexts/UserGlobalContext";

// Interface for plan extraction response
interface PlanExtractionsResponse extends BaseExtractionResponse {
  plan?: ApiPlan;
  activities?: Activity[];
  question_checks: Record<string, boolean>;
  message: string;
}

export function PlanCreatorDynamicUI({ onNext }: { onNext: () => void }) {
  const api = useApiWithAuth();
  const [text, setText] = useState("");
  const [shouldRenderChildren, setShouldRenderChildren] = useState(false);
  const {useCurrentUserDataQuery}=  useUserPlan()
  const currentUserDataQuery = useCurrentUserDataQuery();
  // Track which plan steps we've identified in the text
  const questionChecks = {
    "Does the message mention a goal that is concrete and measurable?": {
      title: "Your plan goal",
      description: "Make sure it's concrete and measurable. E.g. 'Read 12 books a year' instead of 'Read more books'",
    },
    "Does the message mention specific activities to be done, and their unit of measurement? (for example, you could measure 'reading' in 'pages' or 'running' in 'kilometers'). You may suggest the unit of measurement to the user, given the relevant context you have available.": {
      title: "Your activities",
      description: "Mention their name and how they're measured, like pages, sessions, minutes, etc.",
    },
    "Does the message indicate if the plan is on a specific schedule or a times per week basis?": {
      title: "The Plan type",
      description: "Either 'times per week' basis or a custom build specific schedule",
    },
  };

  // Submit text to AI for plan extraction
  const handleSubmit = async (
    text: string
  ): Promise<PlanExtractionsResponse> => {
    setText(text);
    try {
      const response = await api.post("/ai/get-plan-extractions", {
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

  // Handle plan acceptance - uses the plans.py /create-plan endpoint
  const handleAccept = async (data: PlanExtractionsResponse): Promise<void> => {
    try {
      for (const activity of data.activities ?? []) {
        await api.post("/upsert-activity", activity);
      }
      await api.post("/create-plan", data.plan);
      onNext();
      currentUserDataQuery.refetch();
      toast.success("Plan created successfully!");
    } catch (error) {
      console.error("Error creating plan:", error);
      toast.error("Failed to create plan. Please try again.");
      throw error;
    }
  };

  // Handle plan rejection - just log to Telegram
  const handleReject = async (
    feedback: string,
    data: PlanExtractionsResponse
  ): Promise<void> => {
    try {
      await api.post("/ai/reject-plan", {
        feedback,
        plan: data.plan,
        user_message: text,
        ai_message: data.message,
      });
      toast.success("Feedback submitted. Our team was alerted. Let's try again later");
      onNext();
    } catch (error) {
      console.error("Error rejecting plan:", error);
      toast.error("Failed to submit feedback. Please try again.");
      throw error;
    }
  };

  // Render the extracted plan data, inspired by PlanBuildingContainer
  const renderExtractedData = (data: PlanExtractionsResponse) => {
    if (!data.plan) {
      setShouldRenderChildren(false);
      return null;
    }
    setShouldRenderChildren(true);

    return (
      <div className="space-y-4">
        {/* Plan Goal */}
        {data.plan?.goal && (
          <div className="border border-gray-200 rounded-md p-3 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Plan Goal
            </h3>
            <p className="text-gray-900">{data.plan.goal}</p>
          </div>
        )}

        {/* Activities */}
        {data.activities && data.activities.length > 0 && (
          <div className="border border-gray-200 rounded-md p-3 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Activities
            </h3>
            <div className="space-y-2">
              {data.activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-lg">{activity.emoji}</span>
                  <span className="flex-1 text-gray-900">
                    {activity.title || (activity as any).name} (
                    {activity.measure})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan Type */}
        {data.plan?.outlineType && (
          <div className="border border-gray-200 rounded-md p-3 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Plan Type</h3>
            <p className="text-gray-900">
            {data.plan?.outlineType === "specific"
              ? "Specific Dates"
              : "Times Per Week"}
            </p>
            {data.plan?.outlineType === "timesPerWeek" && (
              <p className="text-gray-900">
                {data.plan?.timesPerWeek} times per week
              </p>
            )}
          </div>
        )}

        {/* Sessions */}
        {data.plan?.outlineType === "specific" && data.plan?.sessions && (
          <div className="border border-gray-200 rounded-md p-3 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Sessions</h3>
            {typeof data.plan.sessions === "number" ? (
              <p className="text-gray-900">
                {data.plan.sessions} times per week
              </p>
            ) : (
              <div className="space-y-2">
                {(data.plan.sessions || []).map((session, idx) => {
                  const activity = data.activities?.find(
                    (a) => a.id === session.activityId
                  );
                  return (
                    <div key={idx} className="text-gray-900">
                      {new Date(session.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                      : {activity?.title ?? "Unknown Activity"} ({session.quantity})
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <DynamicUISuggester<PlanExtractionsResponse>
      id="plan-creator"
      title="Great, now let's create a plan for you."
      initialMessage="What do you want to achieve?"
      questionsChecks={questionChecks}
      onSubmit={handleSubmit}
      onAccept={handleAccept}
      onReject={handleReject}
      shouldRenderChildren={shouldRenderChildren}
      renderChildren={renderExtractedData}
      creationMessage="Do you want me to create this plan for you? (You can edit it later)"
      placeholder="1. I want to read 12 books this year 2. reading measured in pages 3. 3 times per week"
    />
  );
}
