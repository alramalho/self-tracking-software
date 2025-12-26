"use client";

import api from "@/lib/api";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { UserRound, Route, Check, Users } from "lucide-react";
import { useEffect, useState } from "react";

const CoachingSelector = () => {
  const { completeStep, setWantsCoaching, planGoal } = useOnboarding();
  const [recommendsCoaching, setRecommendsCoaching] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!planGoal) return;
      try {
        const response = await api.post<{ needsCoaching: boolean }>("/ai/classify-coaching-need", { planGoal });
        setRecommendsCoaching(response.data.needsCoaching);
      } catch (error) {
        console.error("Failed to fetch coaching recommendation:", error);
      }
    };
    fetchRecommendation();
  }, [planGoal]);

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
      description: "Get a personalized plan with structured progression",
      icon: Users,
      features: [
        "Adaptation based on week achievement",
        "AI or Human coached",
        "Great for: progressive and clear objective plans",
      ],
    },
    {
      id: "self-guided",
      value: false,
      title: "Self-Guided",
      description: "Build your own routine with activities you choose",
      icon: UserRound,
      features: [
        "Pick your own activities",
        "Consistent weekly schedule",
        "Great for: recurring habits, simple tracking",
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
          const isRecommended = recommendsCoaching !== null && option.value === recommendsCoaching;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.value)}
              className={`w-full rounded-xl border-2 p-6 text-left transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 ${
                isRecommended ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : "border-border"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {option.title}
                    </h3>
                    {isRecommended && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
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
