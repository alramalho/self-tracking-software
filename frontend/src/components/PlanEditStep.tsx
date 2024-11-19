import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Activity, ApiPlan, GeneratedPlan, useUserPlan } from "@/contexts/UserPlanContext";
import ActivitySelector from "./ActivitySelector";
import { Switch } from "./ui/switch";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import GeneratedPlanRenderer from "./GeneratedPlanRenderer";

interface PlanEditStepProps {
  plan: ApiPlan;
  onClose: () => void;
  onPlanUpdated: () => void;
}

const PlanEditStep: React.FC<PlanEditStepProps> = ({
  plan,
  onClose,
  onPlanUpdated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [onlyTheseActivities, setOnlyTheseActivities] = useState(true);
  const [planDescription, setPlanDescription] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const userActivities = userData?.activities || [];

  useEffect(() => {
    setActivities(Array.from(new Set(
      plan.sessions.map(session => 
        userActivities.find(ua => ua.id === session.activity_id) || null
      ).filter((activity): activity is Activity => activity !== null)
    )));
  }, [userActivities]);

  const handleGenerateUpdate = async () => {
    try {
      setIsGenerating(true);
      setGeneratedPlan(null);
      
      const selectedActivitiesText = activities.length > 0
        ? `Please ${onlyTheseActivities ? "only include" : "include (but not only)"} these activities in plan:\n${
            activities.map(activity => `- "${activity.title}" measured in "${activity.measure}"`).join("\n")
          }\n\n`
        : "";

      const fullDescription = `\nThis is an edit to the existing plan with goal: "${plan.goal}". \n\n${
        selectedActivitiesText
      }. ${planDescription ? `The user provided the additional description which you should solemly take into account over any other considerations or progressiveness: "${planDescription}"` : ""}`;

      const response = await api.post("/generate-plans", {
        goal: plan.goal,
        finishingDate: plan.finishing_date,
        planDescription: fullDescription,
      });

      if (response.data.plans && response.data.plans.length > 0) {
        setGeneratedPlan(response.data.plans[0]);
      }
    } catch (error) {
      console.error("Error generating plan update:", error);
      toast.error("Failed to generate plan update");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!generatedPlan) return;

    try {
      setIsGenerating(true);
      await api.post(`/plans/${plan.id}/update`, {
        updatedPlan: generatedPlan,
      });

      toast.success("Plan updated successfully");
      onPlanUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast.error("Failed to update plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActivitySelect = (activity: Activity) => {
    setActivities(prev => 
      prev.some(a => a.id === activity.id) 
        ? prev.filter(a => a.id !== activity.id)
        : [...prev, activity]
    );
  };

  return (
    <div className="space-y-6">
      {!generatedPlan ? (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-2">Edit Activities</h3>
            <div className="flex items-center gap-2 mb-4">
              <Switch
                checked={onlyTheseActivities}
                onCheckedChange={setOnlyTheseActivities}
              />
              <span className="text-sm text-gray-500">Only use these activities</span>
            </div>
            <ActivitySelector
              activities={activities}
              selectedActivity={undefined}
              onSelectActivity={handleActivitySelect}
              onSaveActivity={(activity) => setActivities(prev => [...prev, activity])}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Additional Customization</h3>
            <Textarea
              value={planDescription}
              onChange={(e) => setPlanDescription(e.target.value)}
              placeholder="Add any specific requirements or preferences for your plan update..."
              className="mb-4"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateUpdate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Update...
                </>
              ) : (
                "Generate Update"
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Preview Updated Plan</h3>
          <GeneratedPlanRenderer
            title={`${plan.goal} - Updated Version`}
            plan={generatedPlan}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setGeneratedPlan(null)}
              className="flex-1"
            >
              Back to Edit
            </Button>
            <Button
              onClick={handleGenerateUpdate}
              className="flex-1"
            >
              Regenerate
            </Button>
            <Button
              onClick={handleConfirmUpdate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm Update"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanEditStep; 