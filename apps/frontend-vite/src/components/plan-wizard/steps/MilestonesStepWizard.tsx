import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { type PlanMilestone } from "@tsw/prisma/types";
import { Flag, Plus, Minus } from "lucide-react";

const MilestonesStepWizard = () => {
  const { milestones, setMilestones, completeStep } = usePlanCreation();

  const addMilestone = () => {
    const previousMilestone = milestones[milestones.length - 1];
    const newMilestone: PlanMilestone = {
      id: crypto.randomUUID(),
      planId: "",
      date: previousMilestone
        ? new Date(new Date(previousMilestone.date).setMonth(new Date(previousMilestone.date).getMonth() + 1))
        : new Date(),
      description: "",
      progress: 0,
      criteria: null,
      createdAt: new Date(),
    };
    setMilestones([...milestones, newMilestone]);
  };

  const updateMilestone = (index: number, field: keyof PlanMilestone, value: string | Date) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    setMilestones(newMilestones);
  };

  const removeMilestone = () => {
    setMilestones(milestones.slice(0, -1));
  };

  const ensureDate = (date: Date | string): Date => {
    return date instanceof Date ? date : new Date(date);
  };

  const handleContinue = () => {
    completeStep("milestones");
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Flag className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Set milestones (optional)
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Break your goal into smaller achievements
        </p>
      </div>

      <div className="space-y-4 px-2">
        {milestones.map((milestone, index) => (
          <div
            key={milestone.id || index}
            className="flex flex-col gap-3 p-4 border rounded-lg"
          >
            <div className="flex gap-4">
              <div className="text-4xl my-auto">{"#" + (index + 1)}</div>
              <div className="flex-1 flex flex-col gap-3">
                <Input
                  value={milestone.description || ""}
                  onChange={(e) => updateMilestone(index, "description", e.target.value)}
                  placeholder="Milestone title"
                  className="text-lg font-medium bg-card"
                />
                <DatePicker
                  className="w-[150px]"
                  selected={ensureDate(milestone.date)}
                  onSelect={(date) => date && updateMilestone(index, "date", date)}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            onClick={removeMilestone}
            variant="outline"
            className="gap-2 border-2 bg-muted w-1/2"
            disabled={milestones.length === 0}
          >
            <Minus className="h-4 w-4" />
            Remove Last
          </Button>
          <Button
            onClick={addMilestone}
            variant="outline"
            className="gap-2 flex-1 border-dashed border-2 bg-muted w-1/2"
          >
            <Plus className="h-4 w-4" />
            Add Milestone
          </Button>
        </div>
      </div>

      <div className="px-2 space-y-3">
        <Button onClick={handleContinue} className="w-full">
          Continue
        </Button>
        {milestones.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            You can add milestones later too
          </p>
        )}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(MilestonesStepWizard);
