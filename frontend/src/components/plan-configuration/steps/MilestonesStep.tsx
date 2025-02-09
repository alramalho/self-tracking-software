import React, { useState, Dispatch, SetStateAction, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus } from "lucide-react";
import Number from "../Number";
import { ApiPlan, Activity, PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup } from "@/contexts/UserPlanContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MilestonesStepProps {
  milestones?: PlanMilestone[];
  setMilestones?: Dispatch<SetStateAction<PlanMilestone[]>>;
  activities: Activity[];
}

const MilestonesStep: React.FC<MilestonesStepProps> = ({
  milestones = [],
  setMilestones = () => {},
  activities = [],
}) => {
  // Add recursive validation function
  const hasValidActivities = (
    criterion: PlanMilestoneCriteria | PlanMilestoneCriteriaGroup,
    activityIds: Set<string>
  ): boolean => {
    // Base case: if it's a simple criterion
    if ('activity_id' in criterion) {
      return activityIds.has(criterion.activity_id);
    }
    
    // Recursive case: if it's a group, check all sub-criteria
    if ('criteria' in criterion) {
      return criterion.criteria.every(subCriterion => 
        hasValidActivities(subCriterion, activityIds)
      );
    }
    
    return false;
  };

  useEffect(() => {
    if (milestones.length === 0) return;

    const activityIds = new Set(activities.map(a => a.id));
    
    const cleanedMilestones = milestones.filter(milestone => 
      milestone.criteria.every(criterion => hasValidActivities(criterion, activityIds))
    );

    if (cleanedMilestones.length !== milestones.length) {
      setMilestones(cleanedMilestones);
    }
  }, [activities, milestones, setMilestones]);

  const addMilestone = () => {
    const defaultActivityId = activities.length > 0 ? activities[0].id : "";
    const previousMilestone = milestones[milestones.length - 1];
    
    const newMilestone: PlanMilestone = {
      date: previousMilestone 
        ? new Date(new Date(previousMilestone.date).setMonth(new Date(previousMilestone.date).getMonth() + 1))
        : new Date(),
      description: previousMilestone ? previousMilestone.description : "",
      criteria: [{
        activity_id: defaultActivityId,
        quantity: 0
      }]
    };
    setMilestones((prevMilestones) => [...prevMilestones, newMilestone]);
  };

  // Add helper function to ensure date is always a Date object
  const ensureDate = (date: Date | string): Date => {
    return date instanceof Date ? date : new Date(date);
  };

  const updateMilestone = (
    index: number,
    field: keyof PlanMilestone,
    value: string | Date | (PlanMilestoneCriteria | PlanMilestoneCriteriaGroup)[]
  ) => {
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) =>
        i === index ? { ...milestone, [field]: value } : milestone
      )
    );
  };

  const updateCriteria = (
    milestoneIndex: number,
    criteriaIndex: number,
    field: keyof PlanMilestoneCriteria,
    value: string | number
  ) => {
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) => {
        if (i === milestoneIndex) {
          const newCriteria = [...milestone.criteria] as PlanMilestoneCriteria[];
          newCriteria[criteriaIndex] = {
            ...newCriteria[criteriaIndex] as PlanMilestoneCriteria,
            [field]: value
          };
          return { ...milestone, criteria: newCriteria };
        }
        return milestone;
      })
    );
  };

  const addCriteria = (milestoneIndex: number) => {
    const defaultActivityId = activities.length > 0 ? activities[0].id : "";
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) => {
        if (i === milestoneIndex) {
          return {
            ...milestone,
            criteria: [...milestone.criteria, { activity_id: defaultActivityId, quantity: 0 }]
          };
        }
        return milestone;
      })
    );
  };

  const removeCriteria = (milestoneIndex: number, criteriaIndex: number) => {
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) => {
        if (i === milestoneIndex) {
          return {
            ...milestone,
            criteria: milestone.criteria.filter((_, j) => j !== criteriaIndex)
          };
        }
        return milestone;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2">
          <Number className="mt-1">6</Number>
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-medium">
              What is your next milestone in this plan?
            </Label>
            <p className="text-sm text-gray-500">
              Set a specific milestone that you want to achieve next in your plan. You can update this as you progress.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, milestoneIndex) => (
          <div key={milestoneIndex} className="space-y-4">
            <div className="flex flex-col gap-4 p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-3xl">⛳️</div>
                <div className="flex-1 flex items-center gap-3">
                  <Input
                    type="date"
                    value={ensureDate(milestone.date).toISOString().split("T")[0]}
                    onChange={(e) =>
                      updateMilestone(milestoneIndex, "date", new Date(e.target.value))
                    }
                  />
                  <Input
                    value={milestone.description}
                    onChange={(e) =>
                      updateMilestone(milestoneIndex, "description", e.target.value)
                    }
                    placeholder="Title"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {milestone.criteria.map((criterion, criteriaIndex) => (
                  <div key={criteriaIndex} className="flex items-center gap-2">
                    {criteriaIndex > 0 && (
                      <Select
                        value="OR"
                        onValueChange={(value) => {
                          // Handle junction change
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Select
                      value={(criterion as PlanMilestoneCriteria).activity_id}
                      onValueChange={(value) =>
                        updateCriteria(milestoneIndex, criteriaIndex, "activity_id", value)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select activity" />
                      </SelectTrigger>
                      <SelectContent>
                        {activities.map((activity) => (
                          <SelectItem key={activity.id} value={activity.id}>
                            {activity.emoji} {activity.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-24"
                      value={(criterion as PlanMilestoneCriteria).quantity}
                      onChange={(e) =>
                        updateCriteria(
                          milestoneIndex,
                          criteriaIndex,
                          "quantity",
                          parseInt(e.target.value)
                        )
                      }
                      placeholder="Quantity"
                    />
                    <span className="text-sm text-gray-500">
                      {activities.find(
                        (a) => a.id === (criterion as PlanMilestoneCriteria).activity_id
                      )?.measure || "units"}
                    </span>
                    {milestone.criteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCriteria(milestoneIndex, criteriaIndex)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addCriteria(milestoneIndex)}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Criteria
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => setMilestones([])}
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
          disabled={false}
        >
          <Plus className="h-4 w-4" />
          Add Next Milestone
        </Button>
      </div>
    </div>
  );
};

export default MilestonesStep;
