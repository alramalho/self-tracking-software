import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface GoalStepProps {
  goal: string;
  setGoal: (goal: string) => void;
  onNext: () => void;
}

const GoalStep: React.FC<GoalStepProps> = ({ goal, setGoal, onNext }) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>What goal do you want to accomplish?</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          id="goal"
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="I want to gain the habit to go to the gym 3 times a week on Mondays, Wednesdays and Tuesdays"
          className="mb-4 text-[16px]"
        />
        <Button
          className="w-full"
          onClick={onNext}
          disabled={!goal.trim()}
        >
          Next
        </Button>
      </CardContent>
    </Card>
  );
};

export default GoalStep; 