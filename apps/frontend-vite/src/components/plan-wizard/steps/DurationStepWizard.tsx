import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { PlanDurationEditor } from "@/components/plan-wizard/PlanFieldEditors";
import { Calendar } from "lucide-react";

const DurationStepWizard = () => {
  const { finishingDate, setFinishingDate, completeStep } = usePlanCreation();

  const handleContinue = () => {
    completeStep("duration");
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Calendar className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Set a target date
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          When do you want to achieve this goal? (optional)
        </p>
      </div>

      <PlanDurationEditor value={finishingDate} onChange={setFinishingDate} />

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full">
          {finishingDate ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(DurationStepWizard);
