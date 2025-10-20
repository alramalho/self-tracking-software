/* eslint-disable react-refresh/only-export-components */
import { useApiWithAuth } from "@/api";
import {
  type BaseExtractionResponse,
  DynamicUISuggester,
} from "@/components/DynamicUISuggester";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { AlertCircle, Goal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PlanGoalSetterResponse extends BaseExtractionResponse {
  goal: string;
  emoji: string;
}

function PlanGoalSetter() {
  const { completeStep, planGoal } = useOnboarding();
  const api = useApiWithAuth();
  const [text, setText] = useState(planGoal);
  const [allAnswered, setAllAnswered] = useState(false);
  const questionChecks = {
    "Does the message mention a goal that is minimally concrete and measurable? (E.g. 'Read 12 books a year' instead of 'Read more books')": {
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
        Object.values(response.data.question_checks).every((e: any) => e.answered)
      );

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };

  const renderExtractedData = (data: PlanGoalSetterResponse) => {

    if (!allAnswered) {
      return null;
    }

    return (
      <div className="space-y-4">
        {data.goal && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Goal
            </h3>
            <div className="space-y-2">
              <span className="text-lg">{data.emoji || "🎯"}{" "}</span>
              <span className="flex-1 text-gray-900 dark:text-gray-100 italic">
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
      planEmoji: data.emoji,
      planType: "specific",
    });
  };

  return (
    <>
      <DynamicUISuggester<PlanGoalSetterResponse>
        id="plan-goal-setter"
        initialValue={planGoal || undefined}
        headerIcon={<Goal className="w-[10rem] h-[10rem] text-blue-600" />}
        title="Let's start by creating you a goal"
        initialMessage="What would you like to achieve?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        onAccept={handleAccept}
        disableEmptySubmit
        renderChildren={renderExtractedData}
        shouldRenderChildren={allAnswered}
        placeholder="For example, 'I want to read 12 books this year'"
        creationMessage="Do you want to accept this goal?"
      />
    </>
  );
}

export default withFadeUpAnimation(PlanGoalSetter);