import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plan, ApiPlan, Activity } from "@/contexts/UserPlanContext";
import OutlineOption from "../OutlineOption";
import NumberInput from "../NumberInput";
import { Loader2 } from "lucide-react";
import PlanSessionsRenderer from "@/components/PlanSessionsRenderer";
import { parseISO } from "date-fns";

interface OutlineStepProps {
  outlineType: Plan["outline_type"];
  setOutlineType: (type: Plan["outline_type"]) => void;
  timesPerWeek: number;
  setTimesPerWeek: (times: number) => void;
  title: string;
  generatedSessions?: ApiPlan['sessions'];
  onRegenerate: () => void;
  activities: Activity[];
  finishingDate?: string;
}

const OutlineStep: React.FC<OutlineStepProps> = ({
  outlineType,
  setOutlineType,
  timesPerWeek,
  setTimesPerWeek,
  title,
  generatedSessions,
  onRegenerate,
  activities,
  finishingDate,
}) => {
  const convertToDisplayPlan = (sessions: ApiPlan['sessions']): Plan => {
    return {
      sessions: sessions.map(session => ({
        ...session,
        date: parseISO(session.date),
        activity_name: activities.find(a => a.id === session.activity_id)?.title,
      })),
      finishing_date: finishingDate ? parseISO(finishingDate) : undefined,
      goal: title,
    } as Plan;
  };

  return (
    <div className="space-y-4">
      <Label>How would you like to outline your plan?</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OutlineOption
          type="specific"
          title="📆 Specific Schedule"
          description="An AI generated plan with a specific weekly schedule"
          isSelected={outlineType === "specific"}
          onSelect={() => setOutlineType("specific")}
        />
        <OutlineOption
          type="times_per_week"
          title="✅ Weekly Count Goal"
          description="A self-serve plan with just a number of sessions per week"
          isSelected={outlineType === "times_per_week"}
          onSelect={() => setOutlineType("times_per_week")}
        />
      </div>

      {outlineType === "times_per_week" && (
        <div className="space-y-4">
          <Label>How many times per week?</Label>
          <NumberInput
            value={timesPerWeek}
            onChange={setTimesPerWeek}
            min={1}
            max={7}
          />
        </div>
      )}

      {outlineType === "specific" && generatedSessions && (
        <div className="space-y-4">
          <Label>Generated Schedule</Label>
          <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
            <PlanSessionsRenderer 
              plan={convertToDisplayPlan(generatedSessions)}
              activities={activities}
            />
          </div>
          <Button onClick={onRegenerate} variant="outline" className="w-full">
            Regenerate Schedule
          </Button>
        </div>
      )}
    </div>
  );
};

export default OutlineStep;
