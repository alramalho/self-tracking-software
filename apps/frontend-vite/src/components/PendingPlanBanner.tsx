import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPendingPlanGoals,
  removePendingPlanGoal,
  type PendingPlanGoal,
} from "@/lib/pendingPlanGoal";
import { v4 as uuidv4 } from "uuid";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

export function PendingPlanBanner() {
  const [pendingGoals, setPendingGoals] = useState<PendingPlanGoal[]>([]);
  const [dismissedGoals, setDismissedGoals] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  useEffect(() => {
    setPendingGoals(getPendingPlanGoals());
  }, []);

  const visibleGoals = pendingGoals.filter(
    (goal) => !dismissedGoals.has(goal.goal)
  );

  if (visibleGoals.length === 0) {
    return null;
  }

  const handleDismiss = (goal: string) => {
    removePendingPlanGoal(goal);
    setDismissedGoals((prev) => new Set(prev).add(goal));
  };

  const handleResume = (goal: PendingPlanGoal) => {
    // Clear onboarding state and set the pending goal directly in localStorage
    // This avoids needing the OnboardingProvider context
    const newOnboardingState = {
      currentStep: "plan-goal-setter",
      completedSteps: [],
      plans: null,
      selectedPlan: null,
      planGoal: goal.goal,
      planEmoji: goal.emoji,
      planActivities: [],
      planProgress: null,
      planType: null,
      planId: uuidv4(),
      partnerType: null,
      planTimesPerWeek: 3,
      isPushGranted: false,
    };
    localStorage.setItem("onboarding-state", JSON.stringify(newOnboardingState));

    // Remove from pending since we're resuming it
    removePendingPlanGoal(goal.goal);

    // Navigate to onboarding
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="space-y-2 mb-4">
      {visibleGoals.map((goal) => (
        <div
          key={goal.goal}
          className={`relative ${variants.verySoftGrandientBg} border ${variants.brightBorder} rounded-xl p-4`}
        >
          <button
            onClick={() => handleDismiss(goal.goal)}
            className="absolute top-2 right-2 p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="flex-shrink-0">
              <Sparkles className={`w-5 h-5 ${variants.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">
                You have a pending goal
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{goal.emoji}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {goal.goal}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex items-center gap-1"
                  onClick={() => handleResume(goal)}
                >
                  <Plus className="w-3 h-3" />
                  Create Plan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(goal.goal)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
