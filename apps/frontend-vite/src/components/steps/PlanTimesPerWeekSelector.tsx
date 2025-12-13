"use client";

import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { Calendar } from "lucide-react";

const PlanTimesPerWeekSelector = () => {
  const { completeStep, planTimesPerWeek, setPlanTimesPerWeek } = useOnboarding();

  const handleContinue = () => {
    completeStep("plan-times-per-week", {
      planTimesPerWeek,
    });
  };

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Calendar className="w-20 h-20 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            How often do you want to practice?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          This is your target - we can adjust it later based on your experience.
        </p>
      </div>

      <div className="space-y-6">
        <NumberInput
          title="Times per Week"
          value={planTimesPerWeek}
          onChange={setPlanTimesPerWeek}
          min={1}
          max={7}
        />

        <Button
          size="lg"
          className="w-full rounded-xl"
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(PlanTimesPerWeekSelector);
