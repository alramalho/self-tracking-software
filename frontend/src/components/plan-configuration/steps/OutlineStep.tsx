import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OutlineOption } from "../OutlineOption";
import NumberInput from "../NumberInput";
import PlanSessionsRenderer from "@/components/PlanSessionsRenderer";
import { parseISO } from "date-fns";
import Number from "../Number";
import { Textarea } from "@/components/ui/textarea";
import { PlanOutlineType } from "@prisma/client";
import { Activity, PlanSession } from "@prisma/client";
import { CompletePlan } from "@/contexts/UserGlobalContext";

interface OutlineStepProps {
  outlineType: PlanOutlineType;
  setOutlineType: (type: PlanOutlineType) => void;
  timesPerWeek: number;
  setTimesPerWeek: (times: number) => void;
  title: string;
  generatedSessions: any[] | undefined;
  canGenerate: () => boolean;
  onGenerate: () => void;
  activities: Activity[];
  finishingDate?: Date;
  description: string;
  setDescription: (description: string) => void;
}

const OutlineStep: React.FC<OutlineStepProps> = ({
  outlineType,
  setOutlineType,
  timesPerWeek,
  setTimesPerWeek,
  title,
  generatedSessions,
  canGenerate,
  onGenerate,
  activities,
  finishingDate,
  description,
  setDescription,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await onGenerate();
    setIsGenerating(false);
  };

  const convertToDisplayPlan = (sessions: PlanSession[]) => {
    return {
      sessions: sessions.map((session) => ({
        ...session,
        date: session.date,
        activityName: activities.find((a) => a.id === session.activityId)
          ?.title,
      })),
      finishingDate: finishingDate ? finishingDate : undefined,
      goal: title,
    };
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Number>5</Number>
          How would you like to track your progress?
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Choose how you want to structure your plan
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OutlineOption
            title="✅ Weekly Count Goal"
            description="A simple, self-serve plan with just a number of sessions per week"
            selected={outlineType === "TIMES_PER_WEEK"}
            onClick={() => setOutlineType("TIMES_PER_WEEK")}
          />
          <OutlineOption
            title="📆 Specific Schedule"
            description="A more complex AI generated plan with a specific weekly schedule"
            selected={outlineType === "SPECIFIC"}
            onClick={() => setOutlineType("SPECIFIC")}
          />
        </div>
      </div>

      {outlineType === "TIMES_PER_WEEK" && (
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

      {outlineType === "SPECIFIC" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="customization-input"
              className="text-lg font-semibold mb-2 block"
            >
              Additional Customization
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Add any specific requirements or preferences to help generate your
              schedule
            </p>
            <Textarea
              id="customization-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: I prefer morning workouts, I want to alternate between activities, etc..."
              className="mb-4 bg-white"
            />
          </div>

          <div className="flex flex-col gap-4">
            {canGenerate() && (
              <Button
                variant={generatedSessions ? "outline" : "default"}
                onClick={handleGenerate}
                loading={isGenerating}
                className="flex-1 gap-2 w-full mt-2"
              >
                {isGenerating
                  ? "Generating..."
                  : generatedSessions
                  ? "Regenerate"
                  : "Generate Plan"}
              </Button>
            )}

            {/* // note to self, we were in the midst of finishing off the migratino to backend node
            // scheduling notifiactions arent yet done */}
            {generatedSessions && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Generated Schedule</h4>
                <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
                  <PlanSessionsRenderer
                    plan={convertToDisplayPlan(generatedSessions) as unknown as CompletePlan}
                    activities={activities}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlineStep;
