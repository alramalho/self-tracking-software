import { useApiWithAuth } from "@/api";
import {
  type BaseExtractionResponse,
  DynamicUISuggester,
} from "@/components/DynamicUISuggester";
import { CoachActivitySuggestionCard } from "@/components/CoachActivitySuggestionCard";
import { shouldShowOnboardingPartnerStep } from "@/components/recommendations/onboardingPartnerGate";
import { useActivities } from "@/contexts/activities/useActivities";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { usePlans } from "@/contexts/plans";
import { useRecommendations } from "@/contexts/recommendations";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import type { Activity } from "@tsw/prisma";
import { AlertCircle, BicepsFlexed, Sparkles, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SuggestedActivity = { title: string; emoji: string; measure: string };

interface PlanActivitySetterResponse extends BaseExtractionResponse {
  activities?: Activity[];
}

function PlanActivitySetter() {
  const {
    planGoal,
    completeStep,
    planActivities,
    planId,
    planEmoji,
    planTimesPerWeek,
  } = useOnboarding();
  const api = useApiWithAuth();
  const { upsertActivity } = useActivities();
  const { upsertPlan } = usePlans();
  const { refetchRecommendations } = useRecommendations();
  const onboardingColors = getThemeVariants("blue");
  const [suggestedActivities, setSuggestedActivities] = useState<SuggestedActivity[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasLoadedSuggestions, setHasLoadedSuggestions] = useState(false);
  const [creatingSuggestion, setCreatingSuggestion] = useState<string | null>(null);
  const [createdFromSuggestions, setCreatedFromSuggestions] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setHasLoadedSuggestions(false);
      if (!planGoal) {
        setSuggestedActivities([]);
        setHasLoadedSuggestions(true);
        return;
      }
      setIsLoadingSuggestions(true);
      try {
        const response = await api.post<{
          recommendedActivityIds: string[];
          suggestedNewActivities: SuggestedActivity[];
        }>("/ai/recommend-activities", { planGoal });
        setSuggestedActivities((response.data.suggestedNewActivities || []).slice(0, 3));
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setIsLoadingSuggestions(false);
        setHasLoadedSuggestions(true);
      }
    };
    fetchSuggestions();
  }, [api, planGoal]);

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
      const response = await api.post("/onboarding/generate-plan-activities", {
        message: text,
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

  const createSelfGuidedPlan = async (activities: Activity[]) => {
    const uniqueActivities = Array.from(
      new Map(activities.map((activity) => [activity.id, activity])).values()
    );

    await Promise.all(
      uniqueActivities.map((activity) =>
        upsertActivity({
          activity,
          muteNotification: true,
        })
      )
    );

    await upsertPlan({
      planId,
      updates: {
        id: planId,
        goal: planGoal || "My Goal",
        emoji: planEmoji || "🎯",
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: planTimesPerWeek,
        activities: uniqueActivities,
        sessions: [],
        milestones: [],
      },
    });
  };

  const completeWithPartnerGate = async (activities: Activity[]) => {
    const uniqueActivities = Array.from(
      new Map(activities.map((activity) => [activity.id, activity])).values()
    );

    await createSelfGuidedPlan(uniqueActivities);

    let shouldShowCommunityStep = true;
    try {
      shouldShowCommunityStep = await shouldShowOnboardingPartnerStep({
        api,
        planId,
        refetchRecommendations,
      });
    } catch (error) {
      console.error("Failed to check community partner matches:", error);
    }

    completeStep(
      "plan-activity-selector",
      { planActivities: uniqueActivities, partnerType: null },
      shouldShowCommunityStep ? undefined : { complete: true }
    );
  };

  const handleAccept = async (
    data: PlanActivitySetterResponse
  ): Promise<void> => {
    const allActivities = [
      ...createdFromSuggestions,
      ...(data.activities ?? []),
    ];
    await completeWithPartnerGate(allActivities);
  };

  const handleAcceptedSuggestionsContinue = async (): Promise<void> => {
    if (createdFromSuggestions.length === 0) return;
    await completeWithPartnerGate(createdFromSuggestions);
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
        <p className={cn("text-sm flex items-center gap-1", onboardingColors.text)}>
          <Sparkles className="w-3 h-3" />
          Coach suggestions
        </p>
        <div className="flex flex-col gap-2">
          {createdFromSuggestions.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                "flex items-center w-full rounded-lg border-2 p-3",
                onboardingColors.border,
                onboardingColors.veryFadedBg
              )}
            >
              <span className="text-3xl mr-3">{activity.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold">{activity.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({activity.measure})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Added to plan
                </p>
              </div>
              <Check className={cn("w-4 h-4 ml-2", onboardingColors.text)} />
            </div>
          ))}
          {suggestedActivities.map((suggestion) => (
            <CoachActivitySuggestionCard
              key={suggestion.title}
              suggestion={suggestion}
              planGoal={planGoal}
              isCreating={creatingSuggestion === suggestion.title}
              tone="blue"
              onReject={() => handleDismissSuggestion(suggestion.title)}
              onAccept={() => handleSelectSuggestion(suggestion)}
            />
          ))}
        </div>
      </div>
    );
  };

  const hasAcceptedSuggestions = createdFromSuggestions.length > 0;
  const hasSuggestionChoices = suggestedActivities.length > 0;
  const emptySubmitButtonText = isLoadingSuggestions
    ? "Finding suggestions..."
    : hasAcceptedSuggestions
      ? "Continue"
      : hasLoadedSuggestions && hasSuggestionChoices
        ? "Accept an activity"
        : "Describe an activity";

  return (
    <>
      <DynamicUISuggester<PlanActivitySetterResponse>
        id="plan-activity-setter"
        initialValue={planActivities?.map((activity) => `${activity.title} (${activity.measure})`).join(", ") || undefined}
        headerIcon={<BicepsFlexed className="w-[10rem] h-[10rem] text-blue-600" />}
        title="Which activities would you like to include?"
        questionsChecks={questionChecks}
        onSubmit={handleSubmit}
        emptySubmitButtonText={emptySubmitButtonText}
        disableEmptySubmit={!hasAcceptedSuggestions}
        onEmptySubmit={handleAcceptedSuggestionsContinue}
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
