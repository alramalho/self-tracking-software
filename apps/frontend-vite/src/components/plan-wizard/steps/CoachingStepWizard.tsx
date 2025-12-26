import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import api from "@/lib/api";
import { Route, Users, UserRound, Check, MoveRight, Crown } from "lucide-react";
import { useEffect, useState } from "react";

const CoachingStepWizard = () => {
  const { goal, setIsCoached, setOutlineType, completeStep } = usePlanCreation();
  const { isUserPremium } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const [recommendsCoaching, setRecommendsCoaching] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (!goal) return;
      try {
        const response = await api.post<{ needsCoaching: boolean }>("/ai/classify-coaching-need", { planGoal: goal });
        setRecommendsCoaching(response.data.needsCoaching);
      } catch (error) {
        console.error("Failed to fetch coaching recommendation:", error);
      }
    };
    fetchRecommendation();
  }, [goal]);

  const handleSelect = (wantsCoaching: boolean) => {
    if (wantsCoaching && !isUserPremium) {
      // Free user wants coaching - show upgrade
      setShowUpgradePopover(true);
      return;
    }

    setIsCoached(wantsCoaching);
    setOutlineType(wantsCoaching ? "SPECIFIC" : "TIMES_PER_WEEK");

    if (wantsCoaching) {
      // Coaching selected - go to coach selector next
      completeStep("coaching", {
        isCoached: true,
        outlineType: "SPECIFIC",
      }, { nextStep: "coach-selector" });
    } else {
      // Self-guided - skip coach selector
      completeStep("coaching", {
        isCoached: false,
        outlineType: "TIMES_PER_WEEK",
      });
    }
  };

  const options = [
    {
      id: "coaching",
      value: true,
      title: "Coaching",
      description: "Get a personalized plan with structured progression",
      icon: Users,
      features: [
        "Specific weekly schedule",
        "Adapted every week based on performance",
        "Great for: progressive and clear objective plans",
      ],
      requiresPremium: true,
    },
    {
      id: "self-guided",
      value: false,
      title: "Self-Guided",
      description: "Build your own routine with activities you choose",
      icon: UserRound,
      features: [
        "On a times per week basis",
        "Great for: recurring habits, simple tracking",
      ],
      requiresPremium: false,
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
          Choose between personalized coaching or self-guided tracking.
        </p>
      </div>

      <div className="space-y-4 px-2">
        {options.map((option) => {
          const Icon = option.icon;
          const isRecommended = recommendsCoaching !== null && option.value === recommendsCoaching;
          const showUpgradeBadge = option.requiresPremium && !isUserPremium;

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-foreground">
                      {option.title}
                    </h3>
                    {isRecommended && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                    {showUpgradeBadge && (
                      <span className="text-xs font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Premium
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
                  {showUpgradeBadge && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <span>Upgrade to unlock</span>
                      <MoveRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(CoachingStepWizard);
