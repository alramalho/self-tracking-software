"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, Route, UserRoundPlus } from "lucide-react";
import { useOnboarding } from "../OnboardingContext";
import { Textarea } from "@/components/ui/textarea";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useState } from "react";

export const PlanProgressInitiator = () => {
  const { completeStep, planProgress } = useOnboarding();
  const [text, setText] = useState<string>(planProgress ?? "");

  const handleComplete = (progress: string) => {
    completeStep("plan-progress-initiator", {
      planProgress: progress,
    });
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
