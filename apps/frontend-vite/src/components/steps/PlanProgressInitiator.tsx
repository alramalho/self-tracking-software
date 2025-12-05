/* eslint-disable react-refresh/only-export-components */

"use client";

import { useApiWithAuth } from "@/api";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useActivities } from "@/contexts/activities/useActivities";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { ArrowRight, Route, Loader2, Lightbulb } from "lucide-react";
import { useState } from "react";

const PlanProgressInitiator = () => {
  const {
    completeStep,
    planId,
    planGoal,
    planEmoji,
    planType,
    planProgress,
    planTimesPerWeek,
    planActivities,
    setPlanTimesPerWeek,
  } = useOnboarding();
  const { upsertPlan } = usePlans();
  const { upsertActivity } = useActivities();
  const { currentUser } = useCurrentUser();
  const api = useApiWithAuth();
  const [text, setText] = useState<string>(planProgress ?? "");
  const [isValidating, setIsValidating] = useState(false);
  const [showSuggestionPopover, setShowSuggestionPopover] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    suggestedTimesPerWeek: number;
    reason: string;
  } | null>(null);
  const [pendingProgress, setPendingProgress] = useState<string>("");

  const finalizePlanAndProceed = async (
    progress: string,
    timesPerWeek: number
  ) => {
    if (planType === "TIMES_PER_WEEK") {
      await Promise.all(
        planActivities.map((activity) =>
          upsertActivity({
            activity: {
              ...activity,
              userId: currentUser?.id,
            },
            muteNotification: true,
          })
        )
      );
      upsertPlan({
        planId: planId,
        updates: {
          goal: planGoal!,
          emoji: planEmoji,
          activities: planActivities,
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: timesPerWeek,
        },
      });
    }
    // Navigation logic is handled by getOnboardingSteps in onboarding.tsx
    completeStep("plan-progress-initiator", {
      planProgress: progress,
      planTimesPerWeek: timesPerWeek,
    });
  };

  const handleComplete = async (progress: string) => {
    // Only validate for TIMES_PER_WEEK plans
    if (planType !== "TIMES_PER_WEEK") {
      finalizePlanAndProceed(progress, planTimesPerWeek);
      return;
    }

    setIsValidating(true);
    setPendingProgress(progress);

    try {
      const response = await api.post("/onboarding/validate-plan-frequency", {
        plan_goal: planGoal,
        plan_progress: progress,
        times_per_week: planTimesPerWeek,
      });

      const { suggested_times_per_week, reason } = response.data;

      if (suggested_times_per_week != null && reason) {
        // AI suggests reducing frequency - show popover
        setSuggestion({
          suggestedTimesPerWeek: suggested_times_per_week,
          reason: reason,
        });
        setShowSuggestionPopover(true);
      } else {
        // No changes needed - proceed directly
        finalizePlanAndProceed(progress, planTimesPerWeek);
      }
    } catch (error) {
      console.error("Error validating plan frequency:", error);
      // On error, proceed without validation
      finalizePlanAndProceed(progress, planTimesPerWeek);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      setPlanTimesPerWeek(suggestion.suggestedTimesPerWeek);
      finalizePlanAndProceed(pendingProgress, suggestion.suggestedTimesPerWeek);
    }
    setShowSuggestionPopover(false);
  };

  const handleKeepOriginal = () => {
    finalizePlanAndProceed(pendingProgress, planTimesPerWeek);
    setShowSuggestionPopover(false);
  };

  return (
    <>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <Route className="w-20 h-20 mx-auto text-blue-600" />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
              How advanced are you already?
            </h2>
          </div>
          <p className="text-md text-muted-foreground">
            Help us understand your starting point.
          </p>
        </div>
        <div className="mx-auto w-full flex flex-col gap-2">
          <TextAreaWithVoice
            value={text}
            onChange={(e) => setText(e)}
            placeholder="For example, 'I'm running 2 times a week for ~2km each time'"
            disabled={isValidating}
          />
          <Button
            size="lg"
            className="w-full rounded-xl"
            onClick={() => {
              handleComplete(
                text.length > 0 ? text : "I'm a complete beginner"
              );
            }}
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                AI is validating your plan...
              </>
            ) : text.length > 0 ? (
              <>
                Save progress
                <ArrowRight size={20} className="ml-2" />
              </>
            ) : (
              <>
                I'm a complete beginner
                <ArrowRight size={20} className="ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Suggestion popover when AI recommends reducing frequency */}
      <AppleLikePopover
        open={showSuggestionPopover}
        onClose={() => setShowSuggestionPopover(false)}
        title="Plan suggestion"
        unclosable
      >
        <div className="space-y-6 pt-6 pb-4">
          <div className="flex flex-col items-center text-center">
            <img
              src="/images/jarvis_logo_blue_transparent.png"
              className="w-14 h-14 my-2"
            />
            <h2 className="text-xl font-semibold mb-2">A tip from Coach</h2>
            <p className="text-sm text-muted-foreground">
              {suggestion?.reason}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your plan</p>
                <p className="text-lg font-semibold">
                  {planTimesPerWeek}x per week
                </p>
              </div>
              <ArrowRight className="text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Our suggestion</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {suggestion?.suggestedTimesPerWeek}x per week
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-2">
            <Button className="w-full" onClick={handleAcceptSuggestion}>
              Accept suggestion ({suggestion?.suggestedTimesPerWeek}x per week)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleKeepOriginal}
            >
              Keep my original ({planTimesPerWeek}x per week)
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
};

export default withFadeUpAnimation(PlanProgressInitiator);
