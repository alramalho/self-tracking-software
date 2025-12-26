import { useApiWithAuth } from "@/api";
import {
  type BaseExtractionResponse,
  DynamicUISuggester,
} from "@/components/DynamicUISuggester";
import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useCurrentUser } from "@/contexts/users";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { savePendingPlanGoal } from "@/lib/pendingPlanGoal";
import { AlertCircle, Goal, Check, Crown, Info } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ExtractedPlan {
  goal: string;
  emoji: string;
}

interface PlanGoalSetterResponse extends BaseExtractionResponse {
  plans?: ExtractedPlan[];
}

const GoalStepWizard = () => {
  const { goal, setGoal, setEmoji, completeStep } = usePlanCreation();
  const api = useApiWithAuth();
  const [text, setText] = useState(goal || "");
  const [allAnswered, setAllAnswered] = useState(false);
  const [showMultiplePlansPopover, setShowMultiplePlansPopover] = useState(false);
  const [extractedPlans, setExtractedPlans] = useState<ExtractedPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
  const { setShowUpgradePopover } = useUpgrade();
  const { isUserFree, isUserPremium } = usePaidPlan();
  const { refetchCurrentUser } = useCurrentUser();

  const [waitingForUpgrade, setWaitingForUpgrade] = useState(false);

  useEffect(() => {
    if (!waitingForUpgrade) return;
    const interval = setInterval(() => {
      refetchCurrentUser(false);
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingForUpgrade, refetchCurrentUser]);

  useEffect(() => {
    if (waitingForUpgrade && isUserPremium && extractedPlans.length > 1) {
      setShowMultiplePlansPopover(true);
      setWaitingForUpgrade(false);
      toast.success("Upgrade successful! Select which goal to create first.");
    }
  }, [isUserPremium, waitingForUpgrade, extractedPlans]);

  const questionChecks = {
    "Does the message mention a goal that is minimally concrete and measurable? (E.g. 'Read 12 books a year' instead of 'Read more books')": {
      icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
      title: "Make sure it is concrete and measurable",
      description:
        "It is important that you phrase your goal in an actionable and tangible way.",
    },
  };

  const handleSubmit = async (text: string): Promise<PlanGoalSetterResponse> => {
    setText(text);
    try {
      const response = await api.post("/onboarding/check-plan-goal", {
        message: text,
        question_checks: Object.keys(questionChecks),
      });

      setAllAnswered(
        Object.values(response.data.question_checks).every((e: any) => e.answered)
      );

      if (response.data.plans) {
        setExtractedPlans(response.data.plans);
        if (response.data.plans.length > 1) {
          setShowMultiplePlansPopover(true);
        }
      }

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };

  const renderExtractedData = (data: PlanGoalSetterResponse) => {
    if (!allAnswered || !data.plans || data.plans.length === 0) {
      return null;
    }

    if (data.plans.length === 1) {
      const plan = data.plans[0];
      return (
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Goal
            </h3>
            <div className="space-y-2">
              <span className="text-lg">{plan.emoji || ""}{" "}</span>
              <span className="flex-1 text-gray-900 dark:text-gray-100 italic">
                {plan.goal}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border border-blue-200 dark:border-blue-700 rounded-md p-3 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            {data.plans.length} Goals Detected
          </h3>
          <div className="space-y-2">
            {data.plans.map((plan, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-lg">{plan.emoji || ""}</span>
                <span className="flex-1 text-gray-900 dark:text-gray-100 italic text-sm">
                  {plan.goal}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleAccept = async (data: PlanGoalSetterResponse): Promise<void> => {
    if (!data.plans || data.plans.length === 0) {
      toast.error("No goals detected. Please try again.");
      return;
    }

    if (data.plans.length === 1) {
      const plan = data.plans[0];
      setGoal(plan.goal);
      setEmoji(plan.emoji || "");
      completeStep("goal", {
        goal: plan.goal,
        emoji: plan.emoji || "",
      });
      return;
    }

    setShowMultiplePlansPopover(true);
  };

  const handlePlanSelection = (index: number) => {
    setSelectedPlanIndex(index);
  };

  const handleConfirmPlanSelection = () => {
    if (selectedPlanIndex === null || !extractedPlans[selectedPlanIndex]) {
      return;
    }

    const selectedPlan = extractedPlans[selectedPlanIndex];
    setGoal(selectedPlan.goal);
    setEmoji(selectedPlan.emoji || "");
    completeStep("goal", {
      goal: selectedPlan.goal,
      emoji: selectedPlan.emoji || "",
    });
    setShowMultiplePlansPopover(false);
  };

  const handleProceedWithSelectedGoal = () => {
    if (selectedPlanIndex === null || !extractedPlans[selectedPlanIndex]) {
      return;
    }

    extractedPlans.forEach((plan, index) => {
      if (index !== selectedPlanIndex) {
        savePendingPlanGoal(plan);
      }
    });

    const selectedPlan = extractedPlans[selectedPlanIndex];
    setGoal(selectedPlan.goal);
    setEmoji(selectedPlan.emoji || "");
    completeStep("goal", {
      goal: selectedPlan.goal,
      emoji: selectedPlan.emoji || "",
    });

    setShowMultiplePlansPopover(false);
    toast.success("You'll be able to create the other plan from your homepage");
  };

  const handleUpgradeClick = () => {
    setWaitingForUpgrade(true);
    setShowUpgradePopover(true);
  };

  return (
    <>
      <DynamicUISuggester<PlanGoalSetterResponse>
        id="plan-goal-wizard"
        initialValue={goal || undefined}
        headerIcon={<Goal className="w-[10rem] h-[10rem] text-blue-600" />}
        title="What's your goal?"
        initialMessage="Describe what you want to achieve"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        onAccept={handleAccept}
        disableEmptySubmit
        renderChildren={renderExtractedData}
        shouldRenderChildren={allAnswered}
        placeholder="For example, 'I want to read 12 books this year'"
        creationMessage="Do you want to accept this goal?"
      />

      {/* Popover for FREE users - must pick one or upgrade */}
      <AppleLikePopover
        open={showMultiplePlansPopover && isUserFree}
        onClose={() => setShowMultiplePlansPopover(false)}
        title="Multiple goals detected"
      >
        <div className="space-y-6 pt-6 pb-4">
          <div className="flex flex-col items-center text-center">
            <Info className="w-12 h-12 text-blue-500 mb-3" />
            <h2 className="text-xl font-semibold mb-2">
              We detected multiple goals!
            </h2>
            <p className="text-sm text-muted-foreground">
              Select one goal to continue, or upgrade to track all of them
            </p>
          </div>

          <div className="space-y-3 px-2">
            {extractedPlans.map((plan, index) => (
              <button
                key={index}
                onClick={() => handlePlanSelection(index)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlanIndex === index
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{plan.emoji || ""}</span>
                  <span className="flex-1 text-foreground font-medium">
                    {plan.goal}
                  </span>
                  {selectedPlanIndex === index && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 px-2">
            <Button
              className="w-full"
              onClick={handleConfirmPlanSelection}
              disabled={selectedPlanIndex === null}
            >
              Continue with selected goal
            </Button>

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleUpgradeClick}
            >
              <Crown className="w-4 h-4 text-yellow-500" />
              Upgrade to track all goals
            </Button>
          </div>
        </div>
      </AppleLikePopover>

      {/* Popover for PAID users - select one goal, save others for later */}
      <AppleLikePopover
        open={showMultiplePlansPopover && isUserPremium}
        onClose={() => setShowMultiplePlansPopover(false)}
        title="Multiple goals detected"
      >
        <div className="space-y-6 pt-6 pb-4">
          <div className="flex flex-col items-center text-center">
            <Info className="w-12 h-12 text-blue-500 mb-3" />
            <h2 className="text-xl font-semibold mb-2">
              We detected multiple goals!
            </h2>
            <p className="text-sm text-muted-foreground">
              Let's set up one plan now. You can create the other from your homepage.
            </p>
          </div>

          <div className="space-y-3 px-2">
            {extractedPlans.map((plan, index) => (
              <button
                key={index}
                onClick={() => handlePlanSelection(index)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlanIndex === index
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{plan.emoji || ""}</span>
                  <span className="flex-1 text-foreground font-medium">
                    {plan.goal}
                  </span>
                  {selectedPlanIndex === index && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 px-2">
            <Button
              className="w-full"
              onClick={handleProceedWithSelectedGoal}
              disabled={selectedPlanIndex === null}
            >
              Create this plan
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
};

export default withFadeUpAnimation(GoalStepWizard);
