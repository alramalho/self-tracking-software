import React from "react";
import Number from "../Number";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import toast from "react-hot-toast";

interface GoalStepProps {
  goal: string;
  setGoal: (goal: string) => void;
  goalConfirmed: boolean;
  setGoalConfirmed: (confirmed: boolean) => void;
  isEdit?: boolean;
}

const GoalStep: React.FC<GoalStepProps> = ({
  goal,
  setGoal,
  goalConfirmed,
  setGoalConfirmed,
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
        {!isEdit && (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (goal.trim().length === 0) {
                  toast.error("Please enter a goal first");
                  return;
                }
                setGoalConfirmed(true);
              }}
              disabled={goalConfirmed}
              className="w-32"
            >
              {goalConfirmed ? <Check className="h-4 w-4" /> : "Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalStep; 