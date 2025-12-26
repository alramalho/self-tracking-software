import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PlanSessionsRenderer from "@/components/PlanSessionsRenderer";
import { type CompletePlan } from "@/contexts/plans";
import { usePlanGeneration } from "@/hooks/usePlanGeneration";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const OutlineStepWizard = () => {
  const {
    goal,
    activities,
    finishingDate,
    description,
    setDescription,
    generatedSessions,
    setGeneratedSessions,
    completeStep,
  } = usePlanCreation();

  const { generateSessions } = usePlanGeneration();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!goal || goal.trim() === "") {
      toast.error("Please enter a goal first");
      return;
    }

    setIsGenerating(true);
    try {
      const sessions = await generateSessions({
        goal,
        finishingDate: finishingDate || undefined,
        activities,
        description: description || undefined,
      });

      setGeneratedSessions(
        sessions.map((session) => ({
          ...session,
          date: new Date(session.date),
        }))
      );
    } catch (error) {
      toast.error("Failed to generate sessions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    completeStep("outline");
  };

  const canContinue = generatedSessions.length > 0;

  const convertToDisplayPlan = () => {
    return {
      sessions: generatedSessions.map((session) => ({
        ...session,
        date: session.date,
        activityName: activities.find((a) => a.id === session.activityId)?.title,
      })),
      finishingDate: finishingDate || undefined,
      goal: goal || "",
    };
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Generate your schedule
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          AI will create a personalized weekly plan for you
        </p>
      </div>

      <div className="space-y-4 px-2">
        <div>
          <Label className="mb-2 block">Additional Customization (optional)</Label>
          <Textarea
            value={description || ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: I prefer morning workouts, I want to alternate between activities, etc..."
            className="mb-4"
          />
        </div>

        <Button
          variant={generatedSessions.length > 0 ? "outline" : "default"}
          onClick={handleGenerate}
          loading={isGenerating}
          className="w-full"
        >
          {isGenerating
            ? "Generating..."
            : generatedSessions.length > 0
            ? "Regenerate Plan"
            : "Generate Plan"}
        </Button>

        {generatedSessions.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Generated Schedule</h4>
            <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4 max-h-64 overflow-y-auto">
              <PlanSessionsRenderer
                plan={convertToDisplayPlan() as unknown as CompletePlan}
                activities={activities}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full" disabled={!canContinue}>
          Continue
        </Button>
        {!canContinue && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Generate a plan to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(OutlineStepWizard);
