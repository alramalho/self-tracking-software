import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar, XCircle } from "lucide-react";

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

      <div className="space-y-4 px-2">
        <div className="flex items-center gap-2">
          <DatePicker
            id="date-picker-trigger"
            selected={finishingDate || undefined}
            onSelect={(date: Date | undefined) => {
              setFinishingDate(date || null);
            }}
            disablePastDates={true}
            className="flex-1"
          />
          {finishingDate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFinishingDate(null)}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>

        {finishingDate && (
          <p className="text-sm text-muted-foreground text-center">
            Target: {finishingDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full">
          {finishingDate ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(DurationStepWizard);
