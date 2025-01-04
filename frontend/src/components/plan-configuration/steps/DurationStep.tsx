import React from "react";
import Number from "../Number";
import DurationOption from "../DurationOption";
import { DatePicker } from "@/components/ui/date-picker";
import { addDays } from "date-fns";

interface DurationStepProps {
  planDuration: {
    type: "custom" | "habit" | "lifestyle" | undefined;
    date?: string;
  };
  currentFinishingDate?: string;
  setPlanDuration: (duration: { type: "custom" | "habit" | "lifestyle" | undefined; date?: string }) => void;
  setCurrentFinishingDate: (date?: string) => void;
  setPlanNotes: (notes: string) => void;
}

const getDateFromDurationType = (type: "habit" | "lifestyle"): string => {
  const today = new Date();
  if (type === "habit") {
    return addDays(today, 21).toISOString(); // 21 days for habit
  } else {
    return addDays(today, 90).toISOString(); // 90 days for lifestyle
  }
};

const DurationStep: React.FC<DurationStepProps> = ({
  planDuration,
  currentFinishingDate,
  setPlanDuration,
  setCurrentFinishingDate,
  setPlanNotes,
}) => {
  return (
    <div className="space-y-4">
      <label className="text-lg font-medium block flex items-center gap-2">
        <Number>1</Number>
        What are you trying to achieve?
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DurationOption
          type="habit"
          emoji="🌱"
          title="Habit Creation"
          description="This will set the finishing date to 21 days from now"
          isSelected={planDuration.type === "habit"}
          onSelect={() => {
            const newDate = getDateFromDurationType("habit");
            setPlanDuration({ type: "habit", date: newDate });
            setCurrentFinishingDate(newDate);
            setPlanNotes(
              "This plan is an habit creation plan (21 days). In order to consider the habit created, all weeks must be completed."
            );
          }}
        />

        <DurationOption
          type="lifestyle"
          emoji="🚀"
          title="Lifestyle Improvement"
          description="This will set the finishing date to 90 days from now"
          isSelected={planDuration.type === "lifestyle"}
          onSelect={() => {
            const newDate = getDateFromDurationType("lifestyle");
            setPlanDuration({ type: "lifestyle", date: newDate });
            setCurrentFinishingDate(newDate);
            setPlanNotes(
              "This plan is an lifestyle improvement plan (90 days). In order to consider the lifestyle improved, at least 90% of the weeks must be completed."
            );
          }}
        />

        <DurationOption
          type="custom"
          emoji="⚡️"
          title="Custom"
          description="Set your own timeline for achieving your goals"
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

      {planDuration.type === "custom" && (
        <div className="mt-4">
          <label
            className="text-sm font-medium mb-2 block"
            htmlFor="date-picker-trigger"
          >
            Set a custom finishing date
          </label>
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
              setPlanDuration({ type: "custom", date: newDate });
            }}
            disablePastDates={true}
          />
        </div>
      )}
    </div>
  );
};

export default DurationStep; 