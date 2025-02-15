import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface DurationTypeStepProps {
  durationType: "habit" | "lifestyle" | "custom" | undefined;
  setDurationType: (type: "habit" | "lifestyle" | "custom") => void;
}

const DurationTypeStep: React.FC<DurationTypeStepProps> = ({
  durationType,
  setDurationType,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">What type of plan is this?</h2>
        <p className="text-sm text-gray-500">Choose how you want to structure your plan</p>
      </div>

      <RadioGroup
        value={durationType}
        onValueChange={(value) => setDurationType(value as "habit" | "lifestyle" | "custom")}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="habit" id="habit" />
          <Label htmlFor="habit">Habit - Regular activities to build consistency</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="lifestyle" id="lifestyle" />
          <Label htmlFor="lifestyle">Lifestyle - Long-term sustainable changes</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="custom" />
          <Label htmlFor="custom">Custom - Specific goals with flexible timing</Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default DurationTypeStep; 