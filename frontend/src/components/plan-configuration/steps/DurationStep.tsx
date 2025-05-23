import React from "react";
import Number from "../Number";
import DurationOption from "../DurationOption";
import { DatePicker } from "@/components/ui/date-picker";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DurationStepProps {
  planDuration: {
    type: "custom" | "habit" | "lifestyle" | undefined;
    date?: string;
  };
  currentFinishingDate?: string;
  setPlanDuration: (duration: {
    type: "custom" | "habit" | "lifestyle" | undefined;
    date?: string;
  }) => void;
  setCurrentFinishingDate: (date?: string) => void;
  setPlanNotes: (notes: string) => void;
}

const DurationStep: React.FC<DurationStepProps> = ({
  planDuration,
  currentFinishingDate,
  setPlanDuration,
  setCurrentFinishingDate,
  setPlanNotes,
}) => {
  return (
    <div className="space-y-8">
      {/* Duration Type Selection */}
      <div className="space-y-4">
        <label className="text-lg font-medium block flex items-center gap-2">
          <Number>1</Number>
          What type of plan is this?
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DurationOption
            type="habit"
            emoji="🌱"
            title="Habit Creation"
            isSelected={planDuration.type === "habit"}
            onSelect={() => {
              setPlanDuration({ type: "habit", date: currentFinishingDate });
              setPlanNotes(
                "This plan is a habit creation plan. In order to consider the habit created, all weeks must be completed."
              );
            }}
          />

          <DurationOption
            type="lifestyle"
            emoji="🚀"
            title="Lifestyle Improvement"
            isSelected={planDuration.type === "lifestyle"}
            onSelect={() => {
              setPlanDuration({
                type: "lifestyle",
                date: currentFinishingDate,
              });
              setPlanNotes(
                "This plan is a lifestyle improvement plan. In order to consider the lifestyle improved, at least 90% of the weeks must be completed."
              );
            }}
          />

          <DurationOption
            type="custom"
            emoji="⚡️"
            title="Custom"
            isSelected={planDuration.type === "custom"}
            onSelect={() => {
              setPlanDuration({
                type: "custom",
                date: currentFinishingDate,
              });
              setPlanNotes("");
            }}
          />
        </div>
      </div>

      {/* Optional Finishing Date Selection */}
      <div className="space-y-4">
        <label className="text-lg font-medium block flex items-center gap-2">
          <Number>2</Number>
          When do you want to finish? (Optional)
        </label>

        <div>
          <label
            className="text-sm font-medium mb-2 block"
            htmlFor="date-picker-trigger"
          >
            Set a target date (optional)
          </label>
          <div className="w-full flex no-wrap items-center gap-2">
            <DatePicker
              id="date-picker-trigger"
              selected={
                currentFinishingDate
                  ? new Date(currentFinishingDate)
                  : undefined
              }
              onSelect={(date: Date | undefined) => {
                const newDate = date?.toISOString();
                setCurrentFinishingDate(newDate);
                setPlanDuration({ ...planDuration, date: newDate });
              }}
              disablePastDates={true}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCurrentFinishingDate(undefined);
                setPlanDuration({ ...planDuration, date: undefined });
              }}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DurationStep;
