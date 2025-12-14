"use client";

import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { UserRound, Route, Check, Users } from "lucide-react";

const CoachingSelector = () => {
  const { completeStep, setWantsCoaching } = useOnboarding();

  const handleSelect = (wantsCoaching: boolean) => {
    setWantsCoaching(wantsCoaching);
    completeStep("coaching-selector", {
      wantsCoaching,
      // Set planType based on coaching choice
      planType: wantsCoaching ? "SPECIFIC" : "TIMES_PER_WEEK",
    });
  };

  const options = [
    {
      id: "coaching",
      value: true,
      title: "Coaching",
      description: "Get a personalized plan with research-backed activities and adaptive scheduling",
      icon: Users,
      features: [
        "Research-based activity suggestions",
        "Adaptive frequency based on your level",
        "Progressive difficulty",
      ],
    },
    {
      id: "self-guided",
      value: false,
      title: "Self-Guided",
      description: "Choose your own activities and track them at your own pace",
      icon: UserRound,
      features: [
        "Pick your own activities",
        "Simple tracking",
        "Full control",
      ],
    },
  ];

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Route className="w-20 h-20 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            How would you like to approach this?
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Choose between AI-powered coaching or self-guided tracking.
        </p>
      </div>

      <div className="space-y-4">
        {options.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.value)}
              className="w-full rounded-xl border-2 border-border p-6 text-left transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {option.title}
                  </h3>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {option.description}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(CoachingSelector);
