import React from "react";
import Number from "../Number";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import OutlineOption from "../OutlineOption";
import { Plan } from "@/contexts/UserPlanContext";

interface OutlineStepProps {
  outlineType: Plan["outline_type"];
  setOutlineType: (type: Plan["outline_type"]) => void;
  timesPerWeek: number;
  setTimesPerWeek: (times: number | ((prev: number) => number)) => void;
}

const OutlineStep: React.FC<OutlineStepProps> = ({
  outlineType,
  setOutlineType,
  timesPerWeek,
  setTimesPerWeek,
}) => {
  return (
    <div className="space-y-4">
      <label className="text-lg font-medium block flex items-center gap-2">
        <Number>5</Number>
        How would you like to outline your plan?
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OutlineOption
          type="specific"
          title="📆 Specific Schedule"
          description="An AI generated plan with a specific weekly schedule"
          isSelected={outlineType === "specific"}
          onSelect={() => setOutlineType("specific")}
        />

        <OutlineOption
          type="times_per_week"
          title="✅ Weekly Count Goal"
          description="A self-serve plan with just a number of sessions per week"
          isSelected={outlineType === "times_per_week"}
          onSelect={() => setOutlineType("times_per_week")}
        />
      </div>

      {outlineType === "times_per_week" && (
        <div className="mt-4">
          <label className="text-sm font-medium mb-2 block">
            How many times per week?
          </label>
          <div className="flex items-center justify-center space-x-2 max-w-xs">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-secondary text-primary-secondary"
              onClick={() =>
                setTimesPerWeek((prev: number) => Math.max(1, prev - 1))
              }
              disabled={timesPerWeek <= 1}
            >
              <Minus className="h-4 w-4" />
              <span className="sr-only">Decrease</span>
            </Button>
            <div className="flex-1 text-center">
              <div className="text-4xl font-bold tracking-tighter">
                {timesPerWeek}
              </div>
              <div className="text-[0.70rem] uppercase text-muted-foreground">
                Times per week
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={() =>
                setTimesPerWeek((prev: number) => Math.min(7, prev + 1))
              }
              disabled={timesPerWeek >= 7}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Increase</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlineStep; 