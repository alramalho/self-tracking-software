import React from "react";
import Number from "../Number";
import { Textarea } from "@/components/ui/textarea";

interface GoalStepProps {
  goal: string;
  setGoal: (goal: string) => void;
  isEdit?: boolean;
}

const GoalStep: React.FC<GoalStepProps> = ({
  goal,
  setGoal,
  isEdit = false,
}) => {
  return (
    <div>
      <label
        className="text-lg font-medium mb-2 block flex items-center gap-2"
        htmlFor="goal"
      >
        <Number>2</Number>
        Great, now what exactly do you want to do?
      </label>
      <div className="space-y-2">
        <Textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="I want to gain the habit to go to the gym 3 times a week..."
          className="text-[16px]"
        />
      </div>
    </div>
  );
};

export default GoalStep; 