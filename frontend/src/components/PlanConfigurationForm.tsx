import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Activity, GeneratedPlan } from "@/contexts/UserPlanContext";
import ActivitySelector from "./ActivitySelector";
import { Switch } from "./ui/switch";
import GeneratedPlanRenderer from "./GeneratedPlanRenderer";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import toast from "react-hot-toast";

interface PlanConfigurationFormProps {
  initialActivities?: Activity[];
  goal: string;
  finishingDate?: string;
  onConfirm: (plan: GeneratedPlan) => Promise<void>;
  onClose: () => void;
  title: string;
  isEdit?: boolean;
}

const PlanConfigurationForm: React.FC<PlanConfigurationFormProps> = ({
  initialActivities = [],
  goal,
  finishingDate,
  onConfirm,
  onClose,
  title,
  isEdit = false,
}) => {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [onlyTheseActivities, setOnlyTheseActivities] = useState(true);
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const { generatePlan } = usePlanGeneration();

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const plan = await generatePlan({
        goal,
        finishingDate,
        activities,
        onlyTheseActivities,
        description,
        isEdit
      });
      setGeneratedPlan(plan);
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!generatedPlan) return;
    try {
      setIsGenerating(true);
      await onConfirm(generatedPlan);
    } catch (error) {
      console.error("Confirmation failed:", error);
      toast.error("Failed to confirm plan");
    } finally {
      setIsGenerating(false);
    }
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
              onSelectActivity={(activity) => {
                setActivities(prev => 
                  prev.some(a => a.id === activity.id) 
                    ? prev.filter(a => a.id !== activity.id)
                    : [...prev, activity]
                );
              }}
              onSaveActivity={(activity) => setActivities(prev => [...prev, activity])}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Additional Customization</h3>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any specific requirements or preferences for your plan..."
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
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                isEdit ? "Generate Update" : "Generate Plan"
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-6 mb-20">
          <h3 className="text-lg font-semibold">Preview Plan</h3>
          <GeneratedPlanRenderer
            title={title}
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
              onClick={handleGenerate}
              className="flex-1"
            >
              Regenerate
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEdit ? "Confirm Update" : "Create Plan"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanConfigurationForm; 