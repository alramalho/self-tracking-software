/* eslint-disable react-refresh/only-export-components */
import { useApiWithAuth } from "@/api";
import {
  type BaseExtractionResponse,
  DynamicUISuggester,
} from "@/components/DynamicUISuggester";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import type { Activity } from "@tsw/prisma";
import { AlertCircle, BicepsFlexed, Sparkles, Loader2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SuggestedActivity = { title: string; emoji: string; measure: string };

interface PlanActivitySetterResponse extends BaseExtractionResponse {
  activities?: Activity[];
}

function PlanActivitySetter() {
  const { planGoal, completeStep, planActivities } = useOnboarding();
  const api = useApiWithAuth();
  const [suggestedActivities, setSuggestedActivities] = useState<SuggestedActivity[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [creatingSuggestion, setCreatingSuggestion] = useState<string | null>(null);
  const [createdFromSuggestions, setCreatedFromSuggestions] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!planGoal) return;
      setIsLoadingSuggestions(true);
      try {
        const response = await api.post<{
          recommendedActivityIds: string[];
          suggestedNewActivities: SuggestedActivity[];
        }>("/ai/recommend-activities", { planGoal });
        setSuggestedActivities(response.data.suggestedNewActivities || []);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [planGoal]);

  const handleSelectSuggestion = async (suggestion: SuggestedActivity) => {
    setCreatingSuggestion(suggestion.title);
    try {
      const response = await api.post<Activity>("/activities/upsert", {
        title: suggestion.title,
        emoji: suggestion.emoji,
        measure: suggestion.measure,
      });
      const created = response.data;
      setCreatedFromSuggestions((prev) => [...prev, created]);
      setSuggestedActivities((prev) =>
        prev.filter((s) => s.title !== suggestion.title)
      );
    } catch (error) {
      console.error("Failed to create suggested activity:", error);
      toast.error("Failed to add activity");
    } finally {
      setCreatingSuggestion(null);
    }
  };
  const questionChecks = {
    "Does the message mention specific activities to be done, and their unit of measurement? (for example, you could measure 'reading' in 'pages' or 'running' in 'kilometers'). You may suggest the unit of measurement to the user, given the relevant context you have available.":
      {
        icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
        title: "Mention their name and how they're measured",
        description:
          "Think of how would you like to log them. ",
      },
  };

  // Submit text to AI for plan extraction
  const handleSubmit = async (
    text: string
  ): Promise<PlanActivitySetterResponse> => {
    try {
      if (!text) {
        text = 'suggest me'
      }
      const response = await api.post("/onboarding/generate-plan-activities", {
        message: text ,
        plan_goal: planGoal,
        question_checks: Object.keys(questionChecks),
      });

      return response.data;
    } catch (error) {
      console.error("Error extracting plan:", error);
      toast.error("Failed to process plan. Please try again.");
      throw error;
    }
  };

  const renderExtractedData = (data: PlanActivitySetterResponse) => {
    return (
      <div className="space-y-4">
        {data.activities && data.activities.length > 0 && (
          <div className="border border-border rounded-md p-3 bg-card">
            <h3 className="text-sm font-medium text-foreground mb-2">
              Activities
            </h3>
            <div className="space-y-2">
              {data.activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-lg">{activity.emoji}</span>
                  <span className="flex-1 text-foreground">
                    {activity.title || (activity as any).name} (
                    {activity.measure})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleAccept = async (data: PlanActivitySetterResponse): Promise<void> => {
    const allActivities = [...createdFromSuggestions, ...(data.activities ?? [])];
    completeStep("plan-activity-selector", { planActivities: allActivities });
  };

  const handleDismissSuggestion = (title: string) => {
    setSuggestedActivities((prev) => prev.filter((s) => s.title !== title));
  };

  const renderSuggestions = () => {
    if (isLoadingSuggestions) {
      return (
        <p className="text-sm text-muted-foreground text-center">
          Finding suggestions...
        </p>
      );
    }
    if (suggestedActivities.length === 0 && createdFromSuggestions.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Coach suggestions
        </p>
        <div className="flex flex-col gap-2">
          {createdFromSuggestions.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center w-full rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3"
            >
              <span className="text-3xl mr-3">{activity.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold">{activity.title}</span>
                <span className="text-xs text-muted-foreground ml-1.5">({activity.measure})</span>
              </div>
              <Check className="w-4 h-4 text-blue-500 ml-2" />
            </div>
          ))}
          {suggestedActivities.map((suggestion) => (
            <div
              key={suggestion.title}
              className="flex items-center w-full rounded-lg border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 p-3 transition-all"
            >
              <span className="text-3xl mr-3">{suggestion.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold">{suggestion.title}</span>
                <span className="text-xs text-muted-foreground ml-1.5">({suggestion.measure})</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => handleDismissSuggestion(suggestion.title)}
                  disabled={creatingSuggestion === suggestion.title}
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSelectSuggestion(suggestion)}
                  disabled={creatingSuggestion === suggestion.title}
                  className="p-1.5 rounded-full text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  {creatingSuggestion === suggestion.title ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <DynamicUISuggester<PlanActivitySetterResponse>
        id="plan-activity-setter"
        initialValue={planActivities?.map((activity) => `${activity.title} (${activity.measure})`).join(", ") || undefined}
        headerIcon={<BicepsFlexed className="w-[10rem] h-[10rem] text-blue-600" />}
        title="Which activities would you like to include?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        canSubmit={() => true}
        emptySubmitButtonText="Suggest"
        onAccept={handleAccept}
        renderChildren={renderExtractedData}
        renderIntermediateComponents={renderSuggestions}
        placeholder="For example 'reading' --> 'pages' or more generically 'working out' –-> 'sessions'"
        creationMessage="Here's the activities? Can I go ahead and create them?"
      />
    </>
  );
}

export default withFadeUpAnimation(PlanActivitySetter);
