import React, { useState } from "react";
import {
  DynamicUISuggester,
  BaseExtractionResponse,
} from "@/components/DynamicUISuggester";
import { toast } from "sonner";
import { useApiWithAuth } from "@/api";
import { useOnboarding } from "../OnboardingContext";
import { AlertCircle, Crosshair } from "lucide-react";

// Interface for plan extraction response
interface PlanGoalSetterResponse extends BaseExtractionResponse {
  goal: string;
}

export function PlanGoalSetter() {
  const { setPlanGoal, completeStep } = useOnboarding();
  const api = useApiWithAuth();
  const [text, setText] = useState("");
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

      const allAnswered = Object.values(response.data.question_checks).every(Boolean);

      if (allAnswered) {
        setTimeout(() => {
          completeStep("plan-goal-setter");
        }, 1000);
      }
      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };


  return (
    <>
      <DynamicUISuggester<PlanGoalSetterResponse>
        id="plan-creator"
        headerIcon={<Crosshair className="w-[20rem] h-[20rem] text-blue-500" />}
        title="Let's get started by creating your plan"
        initialMessage="What's your main goal?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        shouldRenderChildren={false}
        placeholder="For example, 'I want to read 12 books this year'"
      />
    </>
  );
}
