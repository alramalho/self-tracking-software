"use client";

import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useTheme } from "@/contexts/theme/useTheme";
import { UserRound, Route, Check } from "lucide-react";

const CoachingSelector = () => {
  const { completeStep, setWantsCoaching } = useOnboarding();
  const { isDarkMode } = useTheme();

  const handleSelect = (wantsCoaching: boolean) => {
    setWantsCoaching(wantsCoaching);
    completeStep("coaching-selector", {
      wantsCoaching,
      // Set planType based on coaching choice
      planType: wantsCoaching ? "SPECIFIC" : "TIMES_PER_WEEK",
    });
  };

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const options = [
    {
      id: "coaching",
      value: true,
      title: "AI Coaching",
      description: "Get a personalized plan with research-backed activities and adaptive scheduling",
      icon: null, // Uses coach image instead
      features: [
        "Research-based activity suggestions",
        "Adaptive frequency based on your level",
        "Progressive difficulty",
      ],
      recommended: true,
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
      recommended: false,
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
              className={`w-full rounded-xl border-2 p-6 text-left transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 ${
                option.recommended
                  ? "border-blue-300 dark:border-blue-700"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  option.recommended ? "bg-blue-500" : "bg-muted"
                }`}>
                  {Icon ? (
                    <Icon className={`w-6 h-6 ${
                      option.recommended ? "text-white" : "text-muted-foreground"
                    }`} />
                  ) : (
                    <img src={coachIcon} alt="AI Coach" className="w-7 h-7" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {option.title}
                    </h3>
                    {option.recommended && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
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
