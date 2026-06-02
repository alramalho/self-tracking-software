import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import {
  PlanOutlineTypeEditor,
  type PlanOutlineChoice,
} from "@/components/plan-wizard/PlanFieldEditors";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { Route } from "lucide-react";

const CoachingStepWizard = () => {
  const { outlineType, setOutlineType, completeStep } = usePlanCreation();
  const { isUserPremium } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const variants = useThemeColors();

  const handleSelect = (nextOutlineType: PlanOutlineChoice) => {
    setOutlineType(nextOutlineType);
    completeStep("coaching", { outlineType: nextOutlineType });
  };

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Route className={cn("w-20 h-20", variants.text)} />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            How would you like to approach this?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Choose a flexible weekly target or specific scheduled sessions.
        </p>
      </div>

      <PlanOutlineTypeEditor
        value={outlineType}
        onChange={handleSelect}
      />

      {!isUserPremium && (
        <div className="rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-sm font-medium text-foreground">
            Coach automation is a Plus feature.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The coach can still understand your active plans here. Upgrade unlocks proactive check-ins, plan iteration, and session help.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setShowUpgradePopover(true)}
          >
            Upgrade
          </Button>
        </div>
      )}
    </div>
  );
};

export default withFadeUpAnimation(CoachingStepWizard);
