import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { PlanCoachingModeEditor } from "@/components/plan-wizard/PlanFieldEditors";
import api from "@/lib/api";
import { Route } from "lucide-react";
import { useEffect, useState } from "react";

const CoachingStepWizard = () => {
  const { goal, isCoached, setIsCoached, setOutlineType, completeStep } = usePlanCreation();
  const { isUserPremium } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const [recommendsCoaching, setRecommendsCoaching] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!goal) return;
      try {
        const response = await api.post<{ needsCoaching: boolean }>("/ai/classify-coaching-need", { planGoal: goal });
        setRecommendsCoaching(response.data.needsCoaching);
      } catch (error) {
        console.error("Failed to fetch coaching recommendation:", error);
      }
    };
    fetchRecommendation();
  }, [goal]);

  const handleSelect = (wantsCoaching: boolean) => {
    if (wantsCoaching && !isUserPremium) {
      // Free user wants coaching - show upgrade
      setShowUpgradePopover(true);
      return;
    }

    setIsCoached(wantsCoaching);
    setOutlineType(wantsCoaching ? "SPECIFIC" : "TIMES_PER_WEEK");

    if (wantsCoaching) {
      // Coaching selected - go to coach selector next
      completeStep("coaching", {
        isCoached: true,
        outlineType: "SPECIFIC",
      }, { nextStep: "coach-selector" });
    } else {
      // Self-guided - skip coach selector
      completeStep("coaching", {
        isCoached: false,
        outlineType: "TIMES_PER_WEEK",
      });
    }
  };

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Route className="w-20 h-20 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            How would you like to approach this?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Choose between autopilot coaching or self-guided tracking.
        </p>
      </div>

      <PlanCoachingModeEditor
        value={isCoached}
        onChange={handleSelect}
        recommended={recommendsCoaching}
        isUserPremium={isUserPremium}
        onBlockedPremium={() => setShowUpgradePopover(true)}
      />
    </div>
  );
};

export default withFadeUpAnimation(CoachingStepWizard);
