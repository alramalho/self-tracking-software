import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckIcon } from "lucide-react";
import GeneratedPlanRenderer from "./GeneratedPlanRenderer";
import {
  Activity,
  GeneratedPlan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import ActivitySelector from "./ActivitySelector";
import { Switch } from "./ui/switch";

interface PlanGenerationStepProps {
  planDescription: string;
  setPlanDescription: (description: string) => void;
  handleGeneratePlans: () => void;
  isGenerating: boolean;
  generatedPlans: GeneratedPlan[];
  handlePlanSelection: (plan: GeneratedPlan) => void;
  name: string;
}

const PlanGenerationStep: React.FC<PlanGenerationStepProps> = ({
  planDescription,
  setPlanDescription,
  handleGeneratePlans,
  isGenerating,
  generatedPlans,
  handlePlanSelection,
  name,
}) => {
  const [selectedPlanLoading, setSelectedPlanLoading] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>([]);
  const [onlyTheseActivities, setOnlyTheseActivities] = useState(false);
  const [internalPlanDescription, setInternalPlanDescription] = useState(planDescription);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const selectedActivitiesText = activities.length > 0
      ? `Please ${onlyTheseActivities ? 'only include' : 'include (but not only)'} these activities in plan:\n${activities.map(activity => `- "${activity.title}" measured in "${activity.measure}"`).join('\n')}\n\n`
      : '';

    setPlanDescription(selectedActivitiesText + internalPlanDescription);
  }, [activities, onlyTheseActivities]);

  const handleActivitySelect = (activity: Activity) => {
    setSelectedActivities((prev) =>
      prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity]
    );
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Plan Generation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-8">
          <h3 className="text-lg font-semibold">
            Select Your Activities (optional)
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Here you can specify any activities you want to include in your plan
            for sure, if you know them
          </p>
          <div className="flex items-center gap-2 mb-4">
            <Switch
              checked={onlyTheseActivities}
              onCheckedChange={setOnlyTheseActivities}
            />
            <span className="text-sm text-gray-500">
              Only these activities
            </span>
          </div>
          <ActivitySelector
            activities={activities}
            selectedActivity={undefined}
            onSelectActivity={handleActivitySelect}
            onSaveActivity={(activity) => setActivities((prev) => [...prev, activity])}
          />
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold">
            Additional Customization (optional)
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Add any specific requirements or preferences for your plan
          </p>
          <Textarea
            value={internalPlanDescription}
            onChange={(e) => setInternalPlanDescription(e.target.value)}
            placeholder="times per week, days of the week, etc."
            className="mb-4 text-[16px]"
          />
        </div>

        <Button
          className="w-full"
          onClick={handleGeneratePlans}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Plans...
            </>
          ) : (
            <>{generatedPlans.length > 0 ? "Regenerate" : "Generate"} Plans</>
          )}
        </Button>

        {generatedPlans.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Generated Plans</h3>
            {generatedPlans.map((plan) => (
              <div key={plan.id} className="mb-6 border p-4 rounded-md">
                <GeneratedPlanRenderer
                  title={`${name} - ${plan.intensity} intensity`}
                  plan={plan}
                />
                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    setSelectedPlanLoading(true);
                    handlePlanSelection(plan);
                  }}
                >
                  {selectedPlanLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon className="mr-2 h-4 w-4" />
                  )}
                  Select and Create Plan
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanGenerationStep;
