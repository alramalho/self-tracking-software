import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FinishingDateStepProps {
  finishingDate: string | undefined;
  setFinishingDate: (date: string | undefined) => void;
  setPlanNotes: (notes: string) => void;
  isOptional?: boolean;
}

const FinishingDateStep: React.FC<FinishingDateStepProps> = ({
  finishingDate,
  setFinishingDate,
  setPlanNotes,
  isOptional = false,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">When do you want to finish? {isOptional && "(Optional)"}</h2>
        <p className="text-sm text-gray-500">Set a target date for achieving your goal</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="finishing-date">Target Date</Label>
        <Input
          type="date"
          id="finishing-date"
          value={finishingDate?.split("T")[0] || ""}
          onChange={(e) => setFinishingDate(e.target.value ? `${e.target.value}T00:00:00Z` : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-notes">Additional Notes (Optional)</Label>
        <Textarea
          id="plan-notes"
          placeholder="Add any additional notes or context about your plan..."
          onChange={(e) => setPlanNotes(e.target.value)}
        />
      </div>
    </div>
  );
};

export default FinishingDateStep; 