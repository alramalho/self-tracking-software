import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/contexts/activities/useActivities";
import ActivityEditor from "@/components/ActivityEditor";
import { type Activity } from "@tsw/prisma";
import api from "@/lib/api";
import { Dumbbell, Plus, Check, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

const ActivityItem = ({
  activity,
  isSelected,
  isRecommended,
  onToggle,
}: {
  activity: Activity;
  isSelected: boolean;
  isRecommended: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 aspect-square transition-all relative ${
      isSelected
        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
        : isRecommended
        ? "border-dashed border-blue-400 dark:border-blue-500 hover:border-blue-500 bg-input"
        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-input"
    }`}
  >
    {isRecommended && !isSelected && (
      <div className="absolute -top-1 -right-1">
        <Sparkles className="w-3 h-3 text-blue-500" />
      </div>
    )}
    <span className="text-2xl mb-1">{activity.emoji}</span>
    <span className="text-xs font-medium text-center line-clamp-2">
      {activity.title}
    </span>
    {isSelected && (
      <Check className="w-4 h-4 text-blue-500 mt-1" />
    )}
  </button>
);

const ActivitiesStepWizard = () => {
  const { goal, activities: selectedActivities, setActivities, completeStep } = usePlanCreation();
  const { activities: allActivities } = useActivities();
  const [showActivityEditor, setShowActivityEditor] = useState(false);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  // Fetch AI recommendations based on goal
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!goal || !allActivities || allActivities.length === 0) return;

      setIsLoadingRecommendations(true);
      try {
        const response = await api.post<{ recommendedActivityIds: string[] }>(
          "/ai/recommend-activities",
          { planGoal: goal }
        );
        setRecommendedIds(response.data.recommendedActivityIds);

        // Auto-select recommended activities if none are selected yet
        if (selectedActivities.length === 0 && response.data.recommendedActivityIds.length > 0) {
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
  }, [goal, allActivities]);

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
        {!isLoadingRecommendations && recommendedIds.length > 0 && (
          <p className="text-sm text-blue-600 dark:text-blue-400 text-center mb-3 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            Recommended activities highlighted
          </p>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {sortedActivities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isSelected={selectedActivities.some((a) => a.id === activity.id)}
              isRecommended={recommendedIds.includes(activity.id)}
              onToggle={() => handleToggleActivity(activity)}
            />
          ))}
          <button
            onClick={() => setShowActivityEditor(true)}
            className="flex flex-col bg-input items-center justify-center p-4 rounded-lg border-2 border-dashed border-border aspect-square hover:bg-input/50"
          >
            <Plus className="h-6 w-6 text-muted-foreground mb-1" />
            <span className="text-xs font-medium text-muted-foreground">Add New</span>
          </button>
        </div>

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
