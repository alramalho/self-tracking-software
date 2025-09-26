"use client";

import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useActivities } from "@/contexts/activities";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { ArrowRight, Route } from "lucide-react";
import { useState } from "react";
import { withFadeUpAnimation } from "../../lib";
import { useOnboarding } from "../OnboardingContext";

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
  } = useOnboarding();
  const { upsertPlan } = usePlans();
  const { upsertActivity } = useActivities();
  const { currentUser } = useCurrentUser();
  const [text, setText] = useState<string>(planProgress ?? "");

  const handleComplete = async (progress: string) => {
    let nextStep;
    if (planType == "TIMES_PER_WEEK") {
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
          timesPerWeek: planTimesPerWeek,
        },
      });
      nextStep = "partner-selection";
    }
    completeStep(
      "plan-progress-initiator",
      {
        planProgress: progress,
      },
      {
        nextStep: nextStep,
      }
    );
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <Route className="w-20 h-20 mx-auto text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
            How advanced are you already?
          </h2>
        </div>
        <p className="text-md text-gray-600">
          Help us understand your starting point.
        </p>
      </div>
      <div className="mx-auto w-full flex flex-col gap-2">
        <TextAreaWithVoice
          value={text}
          onChange={(e) => setText(e)}
          placeholder="For example, 'I'm running 2 times a week for ~2km each time'"
        />
        <Button
          size="lg"
          className="w-full border-gray-200 rounded-xl"
          onClick={() => {
            handleComplete(text.length > 0 ? text : "I'm a complete beginner");
          }}
        >
          {text.length > 0 ? "Save progress" : "I'm a complete beginner"}
          <ArrowRight size={20} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(PlanProgressInitiator);
