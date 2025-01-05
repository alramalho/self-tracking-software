import React, { useState, Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { format } from "date-fns";
import Number from "../Number";
import { ApiPlan } from "@/contexts/UserPlanContext";

export type Milestone = NonNullable<ApiPlan["milestones"]>[number];

interface MilestonesStepProps {
  milestones?: Milestone[];
  setMilestones?: Dispatch<SetStateAction<Milestone[]>>;
}

const MilestonesStep: React.FC<MilestonesStepProps> = ({
  milestones = [],
  setMilestones = () => {},
}) => {
  const addMilestone = () => {
    const newMilestone: Milestone = {
      date: new Date().toISOString().split("T")[0],
      description: "",
    };
    setMilestones((prevMilestones: Milestone[]) => [
      ...prevMilestones,
      newMilestone,
    ]);
  };

  const removeMilestone = (index: number) => {
    const updatedMilestones = milestones.filter((_, i) => i !== index);
    setMilestones(updatedMilestones);
  };

  const updateMilestone = (
    index: number,
    field: keyof Milestone,
    value: string
  ) => {
    const updatedMilestones = milestones.map((milestone, i) => {
      if (i === index) {
        return {
          ...milestone,
          [field]: value,
        };
      }
      return milestone;
    });
    setMilestones(updatedMilestones);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2">
          <Number className="mt-1">6</Number>
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-medium">
              Are there any trackable milestones in your plan?
            </Label>
            <p className="text-sm text-gray-500 text-sm">
              For example, a goal to read 12 books in a year could have 12
              &apos;read a book&apos; milestones.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, index) => (
          <div
            key={index}
            className="flex items-center gap-3"
          >
            <div className="text-3xl">⛳️</div>
            <div className="flex-1 flex items-center gap-3">
              <Input
                type="date"
                value={new Date(milestone.date).toISOString().split("T")[0]}
                onChange={(e) => updateMilestone(index, "date", e.target.value)}
              />
              <Input
                value={milestone.description}
                onChange={(e) =>
                  updateMilestone(index, "description", e.target.value)
                }
                placeholder="Title"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() =>
            milestones.length > 0 && removeMilestone(milestones.length - 1)
          }
          variant="outline"
          className="gap-2 border-2 bg-gray-50 w-1/2"
          disabled={milestones.length === 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          onClick={addMilestone}
          variant="outline"
          className="gap-2 flex-1 border-dashed border-2 border-dashed bg-gray-50 w-1/2"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </Button>
      </div>
    </div>
  );
};

export default MilestonesStep;
