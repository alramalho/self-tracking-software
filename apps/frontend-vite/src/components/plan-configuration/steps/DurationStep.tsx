import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { XCircle } from "lucide-react";
import React from "react";
import Number from "../Number";

interface DurationStepProps {
  number: number;
  currentFinishingDate?: Date;
  setCurrentFinishingDate: (date?: Date) => void;
}

const DurationStep: React.FC<DurationStepProps> = ({
  number,
  currentFinishingDate,
  setCurrentFinishingDate,
}) => {
  return (
    <div className="space-y-4">
      <label className="text-lg font-medium block flex items-center gap-2">
        <Number>{number}</Number>
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
                ? currentFinishingDate
                : undefined
            }
            onSelect={(date: Date | undefined) => {
              setCurrentFinishingDate(date);
            }}
            disablePastDates={true}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCurrentFinishingDate(undefined);
            }}
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DurationStep;
