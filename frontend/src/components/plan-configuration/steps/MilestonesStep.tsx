import React, { useState, Dispatch, SetStateAction, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Info, Check } from "lucide-react";
import Number from "../Number";
import { ApiPlan, Activity, PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup } from "@/contexts/UserPlanContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import Divider from "@/components/Divider";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

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
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Track validation state
  const [validationErrors, setValidationErrors] = useState<{
    [key: number]: { 
      title?: boolean; 
      criteria?: { [key: number]: boolean };
      decreasingTarget?: boolean;
    }
  }>({});

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
      !milestone.criteria || (milestone.criteria && milestone.criteria.every(criterion => hasValidActivities(criterion, activityIds)))
    );

    if (cleanedMilestones.length !== milestones.length) {
      setMilestones(cleanedMilestones);
    }
  }, [activities, milestones, setMilestones]);

  // Validation effect
  useEffect(() => {
    const errors: typeof validationErrors = {};
    
    milestones.forEach((milestone, index) => {
      const milestoneErrors: typeof validationErrors[number] = {};
      
      // Check title
      if (!milestone.description?.trim()) {
        milestoneErrors.title = true;
      }
      
      if (Object.keys(milestoneErrors).length > 0) {
        errors[index] = milestoneErrors;
      }
    });
    
    setValidationErrors(errors);
  }, [milestones]);

  // Validate quantity on blur
  const validateQuantity = (
    milestoneIndex: number,
    criteriaIndex: number,
    quantity: number
  ) => {
    const errors = { ...validationErrors };
    
    if (quantity <= 0) {
      errors[milestoneIndex] = {
        ...errors[milestoneIndex],
        criteria: {
          ...(errors[milestoneIndex]?.criteria || {}),
          [criteriaIndex]: true
        }
      };
    } else {
      // Clear the error if it exists
      if (errors[milestoneIndex]?.criteria?.[criteriaIndex]) {
        delete errors[milestoneIndex].criteria![criteriaIndex];
        if (Object.keys(errors[milestoneIndex].criteria!).length === 0) {
          delete errors[milestoneIndex].criteria;
          if (Object.keys(errors[milestoneIndex]).length === 0) {
            delete errors[milestoneIndex];
          }
        }
      }
    }

    setValidationErrors(errors);
  };

  // Validate milestone targets are increasing
  const validateMilestoneTargets = (
    milestoneIndex: number,
    currentMilestone: PlanMilestone,
  ) => {
    const errors = { ...validationErrors };
    
    // Get previous milestone's total target
    const previousMilestone = milestones[milestoneIndex - 1];
    const previousTotal = previousMilestone?.criteria?.reduce((sum, c) => 
      'quantity' in c ? sum + c.quantity : sum, 0) || 0;

    // Get current milestone's total target
    const currentTotal = (currentMilestone.criteria || []).reduce((sum, c) => 
      'quantity' in c ? sum + (c.quantity || 0) : sum, 0);

    if (milestoneIndex > 0 && currentTotal <= previousTotal) {
      errors[milestoneIndex] = {
        ...errors[milestoneIndex],
        decreasingTarget: true,
      };
    } else {
      // Clear the error if it exists
      if (errors[milestoneIndex]?.decreasingTarget) {
        delete errors[milestoneIndex].decreasingTarget;
        if (Object.keys(errors[milestoneIndex]).length === 0) {
          delete errors[milestoneIndex];
        }
      }
    }

    setValidationErrors(errors);
  };

  const addMilestone = () => {
    const previousMilestone = milestones[milestones.length - 1];
    
    const newMilestone: PlanMilestone = {
      date: previousMilestone 
        ? new Date(new Date(previousMilestone.date).setMonth(new Date(previousMilestone.date).getMonth() + 1))
        : new Date(),
      description: "",
      progress: 0,
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
    value: string | Date | (PlanMilestoneCriteria | PlanMilestoneCriteriaGroup)[] | number | null
  ) => {
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) =>
        i === index ? { ...milestone, [field]: value } : milestone
      )
    );
  };

  const adjustProgress = (milestoneIndex: number, increment: boolean) => {
    const milestone = milestones[milestoneIndex];
    const currentProgress = milestone.progress ?? 0;
    const newProgress = Math.min(Math.max(currentProgress + (increment ? 10 : -10), 0), 100);
    updateMilestone(milestoneIndex, "progress", newProgress);
  };

  const updateCriteria = (
    milestoneIndex: number,
    criteriaIndex: number,
    field: keyof PlanMilestoneCriteria,
    value: string | number
  ) => {
    const newMilestones = [...milestones];
    const milestone = newMilestones[milestoneIndex];
    
    if (!milestone.criteria) {
      milestone.criteria = [];
    }
    
    const criteria = milestone.criteria[criteriaIndex] as PlanMilestoneCriteria;

    const updatedCriteria = {
      ...criteria,
      [field]: value,
    };

    milestone.criteria[criteriaIndex] = updatedCriteria;
    setMilestones(newMilestones);
  };

  const addCriteria = (milestoneIndex: number) => {
    const defaultActivityId = activities.length > 0 ? activities[0].id : "";
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) => {
        if (i === milestoneIndex) {
          const currentCriteria = milestone.criteria || [];
          return {
            ...milestone,
            criteria: [...currentCriteria, { activity_id: defaultActivityId, quantity: 1 }]
          };
        }
        return milestone;
      })
    );
  };

  const removeCriteria = (milestoneIndex: number, criteriaIndex: number) => {
    setMilestones((prevMilestones) =>
      prevMilestones.map((milestone, i) => {
        if (i === milestoneIndex && milestone.criteria) {
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
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-2">
          <Number className="mt-1">6</Number>
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-medium">
              What are your next milestones in this plan?
            </Label>
            <p className="text-sm text-gray-500">
              Set specific milestones that you want to achieve next in your plan. You can update this as you progress.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone, milestoneIndex) => (
          <div key={milestoneIndex} className="space-y-4 max-w-md">
            <div className={cn(
              "flex flex-col gap-4 p-4 border rounded-lg",
              validationErrors[milestoneIndex]?.title && "border-red-500"
            )}>
              <div className="flex gap-4">
                <div className="text-6xl my-auto">⛳️</div>
                <div className="flex-1 flex flex-col gap-3">
                  <Input
                    value={milestone.description}
                    onChange={(e) =>
                      updateMilestone(milestoneIndex, "description", e.target.value)
                    }
                    placeholder="Milestone title"
                    className={cn(
                      "text-lg font-medium bg-white",
                      validationErrors[milestoneIndex]?.title && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {validationErrors[milestoneIndex]?.title && (
                    <p className="text-sm text-red-500">Title is required</p>
                  )}
                  <DatePicker
                    className="w-[150px]"
                    selected={ensureDate(milestone.date)}
                    onSelect={(date) => date && updateMilestone(milestoneIndex, "date", date)}
                  />
                </div>
              </div>

              <Divider />

              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (milestone.criteria?.length) {
                        updateMilestone(milestoneIndex, "criteria", null);
                        updateMilestone(milestoneIndex, "progress", 0);
                      }
                    }}
                    className={cn(
                      "flex-1",
                      !milestone.criteria?.length && cn("border-2", variants.card.selected.border, variants.card.selected.bg),
                      milestone.criteria?.length && "bg-white"
                    )}
                  >
                    Manual Progress
                    {!milestone.criteria?.length && <Check className={cn("ml-2 h-4 w-4", variants.text)}/>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!milestone.criteria?.length) {
                        updateMilestone(milestoneIndex, "progress", null);
                        addCriteria(milestoneIndex);
                      }
                    }}
                    className={cn(
                      "flex-1",
                      milestone.criteria?.length && cn("border-2",variants.card.selected.border, variants.card.selected.bg),
                      !milestone.criteria?.length && "bg-white"
                    )}
                  >
                    Activity Criteria 
                    {milestone.criteria?.length && <Check className={cn("ml-2 h-4 w-4", variants.text)}/>}
                  </Button>
                </div>

                {(!milestone.criteria || milestone.criteria.length === 0) ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adjustProgress(milestoneIndex, false)}
                        disabled={typeof milestone.progress !== 'number' || milestone.progress <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-semibold">
                          {typeof milestone.progress === 'number' ? milestone.progress : 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          PERCENT
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => adjustProgress(milestoneIndex, true)}
                        disabled={typeof milestone.progress === 'number' && milestone.progress >= 100}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
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
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            className={cn(
                              "w-24",
                              validationErrors[milestoneIndex]?.criteria?.[criteriaIndex] && "border-red-500 focus-visible:ring-red-500"
                            )}
                            value={(criterion as PlanMilestoneCriteria).quantity}
                            onChange={(e) =>
                              updateCriteria(
                                milestoneIndex,
                                criteriaIndex,
                                "quantity",
                                parseInt(e.target.value) || 0
                              )
                            }
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              validateQuantity(milestoneIndex, criteriaIndex, value);
                              validateMilestoneTargets(milestoneIndex, milestones[milestoneIndex]);
                            }}
                            placeholder="Quantity"
                          />
                          {validationErrors[milestoneIndex]?.criteria?.[criteriaIndex] && (
                            <p className="text-sm text-red-500">Must be greater than 0</p>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {activities.find(
                            (a) => a.id === (criterion as PlanMilestoneCriteria).activity_id
                          )?.measure || "units"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCriteria(milestoneIndex, criteriaIndex)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addCriteria(milestoneIndex)}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Another Criteria
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {validationErrors[milestoneIndex]?.decreasingTarget && (
              <div className="text-red-500 text-sm mt-2">
                Total target must be greater than the previous milestone&apos;s target
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => setMilestones(prev => prev.slice(0, -1))}
          variant="outline"
          className="gap-2 border-2 bg-gray-50 w-1/2"
          disabled={milestones.length === 0}
        >
          <Minus className="h-4 w-4" />
          Remove Last
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

      <div className="mt-6 flex items-start space-x-2">
        <Info className="w-5 h-5 text-gray-500 mt-1 flex-shrink-0" />
        <p className="text-sm text-gray-500">
          Milestone targets are cumulative, meaning each milestone&apos;s total target should be greater than the previous one. 
          For example, if your first milestone is 100km and your second is 300km, you need to run a total of 300km by the second milestone.
        </p>
      </div>
    </div>
  );
};

export default MilestonesStep;
