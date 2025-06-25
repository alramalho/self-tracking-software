import React, { useEffect, useState } from "react";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "@/components/DynamicUISuggester";
import { toast } from "sonner";
import { useApiWithAuth } from "@/api";
import { useOnboarding } from "../OnboardingContext";
import { AlertCircle, Crosshair, Goal } from "lucide-react";
import { withFadeUpAnimation } from "../../lib";

interface PlanGoalSetterResponse extends BaseExtractionResponse {
  goal: string;
}

function PlanGoalSetter() {
  const { completeStep, planGoal } = useOnboarding();
  const api = useApiWithAuth();
  const [text, setText] = useState(planGoal);
  const [allAnswered, setAllAnswered] = useState(false);
  const questionChecks = {
    "Does the message mention a goal that is concrete and measurable?": {
      icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
      title: "Make sure it is concrete and measurable",
      description:
        "It is important that you phrase your goal in an actionable and tangible way.",
    },
  };

  // Submit text to AI for plan extraction
  const handleSubmit = async (
    text: string
  ): Promise<PlanGoalSetterResponse> => {
    console.log("handleSubmit", text);
    setText(text);
    try {
      const response = await api.post("/onboarding/check-plan-goal", {
        message: text,
        question_checks: Object.keys(questionChecks),
      });

      setAllAnswered(
        Object.values(response.data.question_checks).every(Boolean)
      );

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };
  
  useEffect(() => {
    console.log({allAnswered})
  }, [allAnswered]);

  const renderExtractedData = (data: PlanGoalSetterResponse) => {

    console.log("renderExtractedData")
    console.log({allAnswered})
    console.log({data})

    if (!allAnswered) {
      return null;
    }

    return (
      <div className="space-y-4">
        {data.goal && (
          <div className="border border-gray-200 rounded-md p-3 bg-white">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Goal
            </h3>
            <div className="space-y-2">
              <span className="text-lg">🎯{" "}</span>
              <span className="flex-1 text-gray-900 italic">
                {data.goal}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleAccept = async (data: PlanGoalSetterResponse): Promise<void> => {
    completeStep("plan-goal-setter", {
      planGoal: data.goal,
      planType: "specific",
    });
  };

  return (
    <>
      <DynamicUISuggester<PlanGoalSetterResponse>
        id="plan-creator"
        initialValue={planGoal || undefined}
        headerIcon={<Goal className="w-[10rem] h-[10rem] text-blue-600" />}
        title="Let's start by creating you a goal"
        initialMessage="What would you like to achieve?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        onAccept={handleAccept}
        renderChildren={renderExtractedData}
        placeholder="For example, 'I want to read 12 books this year'"
        creationMessage="Do you want to accept this goal?"
      />
    </>
  );
}

export default withFadeUpAnimation(PlanGoalSetter);