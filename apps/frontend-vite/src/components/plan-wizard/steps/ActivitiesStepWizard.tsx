import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import ActivityEditor from "@/components/ActivityEditor";
import { CoachActivitySuggestionCard } from "@/components/CoachActivitySuggestionCard";
import { ActivityPickerGrid } from "@/components/plan-wizard/PlanFieldEditors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { type Activity } from "@tsw/prisma";
import api from "@/lib/api";
import { Dumbbell, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type SuggestedActivity = { title: string; emoji: string; measure: string };

const ActivitiesStepWizard = () => {
  const { goal, activities: selectedActivities, setActivities, completeStep } = usePlanCreation();
  const { activities: allActivities } = useActivities();
  const queryClient = useQueryClient();
  const themeColors = useThemeColors();
  const [showActivityEditor, setShowActivityEditor] = useState(false);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [suggestedNewActivities, setSuggestedNewActivities] = useState<SuggestedActivity[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [creatingSuggestion, setCreatingSuggestion] = useState<string | null>(null);

  // Fetch AI recommendations based on goal
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!goal) return;

      setIsLoadingRecommendations(true);
      try {
        const response = await api.post<{
          recommendedActivityIds: string[];
          suggestedNewActivities: SuggestedActivity[];
        }>("/ai/recommend-activities", { planGoal: goal });
        setRecommendedIds(response.data.recommendedActivityIds);
        setSuggestedNewActivities(response.data.suggestedNewActivities || []);

        // Auto-select recommended activities if none are selected yet
        if (selectedActivities.length === 0 && response.data.recommendedActivityIds.length > 0 && allActivities) {
          const recommended = allActivities.filter((a) =>
            response.data.recommendedActivityIds.includes(a.id)
          );
          if (recommended.length > 0) {
            setActivities(recommended);
          }
        }
      } catch (error) {
        console.error("Failed to fetch activity recommendations:", error);
      } finally {
        setIsLoadingRecommendations(false);
      }
    };

    fetchRecommendations();
  }, [goal]);

  const handleSelectSuggestion = async (suggestion: SuggestedActivity) => {
    setCreatingSuggestion(suggestion.title);
    try {
      const response = await api.post<Activity>("/activities/upsert", {
        title: suggestion.title,
        emoji: suggestion.emoji,
        measure: suggestion.measure,
      });
      const created = response.data;
      setActivities([...selectedActivities, created]);
      setSuggestedNewActivities((prev) =>
        prev.filter((s) => s.title !== suggestion.title)
      );
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    } catch (error) {
      console.error("Failed to create suggested activity:", error);
    } finally {
      setCreatingSuggestion(null);
    }
  };

  const handleDismissSuggestion = (title: string) => {
    setSuggestedNewActivities((prev) => prev.filter((s) => s.title !== title));
  };

  const handleToggleActivity = (activity: Activity) => {
    if (selectedActivities.some((a) => a.id === activity.id)) {
      setActivities(selectedActivities.filter((a) => a.id !== activity.id));
    } else {
      setActivities([...selectedActivities, activity]);
    }
  };

  const handleContinue = () => {
    completeStep("activities");
  };

  const canContinue = selectedActivities.length > 0;

  // Sort activities: recommended first, then alphabetical
  const sortedActivities = [...(allActivities || [])].sort((a, b) => {
    const aRecommended = recommendedIds.includes(a.id);
    const bRecommended = recommendedIds.includes(b.id);
    if (aRecommended && !bRecommended) return -1;
    if (!aRecommended && bRecommended) return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Dumbbell className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Choose your activities
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Select the activities you'll track for this plan
        </p>
      </div>

      <div className="px-2">
        {isLoadingRecommendations && (
          <p className="text-sm text-muted-foreground text-center mb-3">
            Finding recommended activities...
          </p>
        )}

        {!isLoadingRecommendations && suggestedNewActivities.length > 0 && (
          <div className="mb-4">
            <p className={cn("text-sm mb-2 flex items-center gap-1", themeColors.text)}>
              <Sparkles className="w-3 h-3" />
              Coach suggestions
            </p>
            <div className="flex flex-col gap-2">
              {suggestedNewActivities.map((suggestion) => (
                <CoachActivitySuggestionCard
                  key={suggestion.title}
                  suggestion={suggestion}
                  planGoal={goal}
                  isCreating={creatingSuggestion === suggestion.title}
                  onReject={() => handleDismissSuggestion(suggestion.title)}
                  onAccept={() => handleSelectSuggestion(suggestion)}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoadingRecommendations && recommendedIds.length > 0 && (
          <p className={cn("text-sm text-left mb-3 flex items-center justify-start gap-1", themeColors.text)}>
            <Sparkles className="w-3 h-3" />
            Recommended activities highlighted
          </p>
        )}
        <ActivityPickerGrid
          activities={sortedActivities}
          selectedActivities={selectedActivities}
          recommendedIds={recommendedIds}
          onToggle={(activity) => handleToggleActivity(activity as Activity)}
          onAddNew={() => setShowActivityEditor(true)}
        />

        {selectedActivities.length > 0 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            {selectedActivities.length} activit{selectedActivities.length === 1 ? "y" : "ies"} selected
          </p>
        )}
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full" disabled={!canContinue}>
          Continue
        </Button>
        {!canContinue && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Select at least one activity
          </p>
        )}
      </div>

      <ActivityEditor
        open={showActivityEditor}
        onClose={() => setShowActivityEditor(false)}
      />
    </div>
  );
};

export default withFadeUpAnimation(ActivitiesStepWizard);
