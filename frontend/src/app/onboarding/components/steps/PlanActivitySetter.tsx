import React, { useState } from "react";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "@/components/DynamicUISuggester";
import { toast } from "sonner";
import { useApiWithAuth } from "@/api";
import { useOnboarding } from "../OnboardingContext";
import { AlertCircle, BicepsFlexed, Crosshair, Goal, Volleyball } from "lucide-react";
import { Activity } from "@/contexts/UserPlanContext";
import { withFadeUpAnimation } from "../../lib";

interface PlanActivitySetterResponse extends BaseExtractionResponse {
  activities?: Activity[];
}

function PlanActivitySetter() {
  const { planGoal, completeStep } = useOnboarding();
  const api = useApiWithAuth();
  const [text, setText] = useState("");
  const questionChecks = {
    "Does the message mention specific activities to be done, and their unit of measurement? (for example, you could measure 'reading' in 'pages' or 'running' in 'kilometers'). You may suggest the unit of measurement to the user, given the relevant context you have available.":
      {
        icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
        title: "Mention their name and how they're measured",
        description:
          "Think of how would you like to log them. ",
      },
  };

  // Submit text to AI for plan extraction
  const handleSubmit = async (
    text: string
  ): Promise<PlanActivitySetterResponse> => {
    try {
      const response = await api.post("/onboarding/generate-plan-activities", {
        message: text,
        plan_goal: planGoal,
        question_checks: Object.keys(questionChecks),
      });

      console.log(response.data);

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };

  const renderExtractedData = (data: PlanActivitySetterResponse) => {
    return (
      <div className="space-y-4">
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
      </div>
    );
  };

  const handleAccept = async (data: PlanActivitySetterResponse): Promise<void> => {
    completeStep("plan-activity-selector", { planActivities: data.activities ?? [] });
  };
  return (
    <>
      <DynamicUISuggester<PlanActivitySetterResponse>
        id="plan-creator"
        headerIcon={<BicepsFlexed className="w-[10rem] h-[10rem] text-blue-600" />}
        title="Which activities would like to include?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        canSubmitEmpty={true}
        emptySubmitButtonText="Suggest"
        onAccept={handleAccept}
        renderChildren={renderExtractedData}
        placeholder="For example 'reading' --> 'pages' or more generically 'working out' –-> 'sessions'"
        creationMessage="Here's the activities? Can I go ahead and create them?"
      />
    </>
  );
}

export default withFadeUpAnimation(PlanActivitySetter);