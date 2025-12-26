import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import NumberInput from "@/components/NumberInput";
import { CalendarCheck } from "lucide-react";

const TimesPerWeekStepWizard = () => {
  const { timesPerWeek, setTimesPerWeek, completeStep } = usePlanCreation();

  const handleContinue = () => {
    completeStep("times-per-week", {
      timesPerWeek: timesPerWeek || 3,
    });
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <CalendarCheck className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            How often?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          How many times per week would you like to work on this?
        </p>
      </div>

      <div className="px-2 py-8">
        <NumberInput
          value={timesPerWeek || 3}
          onChange={setTimesPerWeek}
          min={1}
          max={7}
          title="times per week"
        />
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(TimesPerWeekStepWizard);
