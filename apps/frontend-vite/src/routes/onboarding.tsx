import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { OnboardingRouteSearch } from "@/components/onboarding/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingRouteSearch => ({
    goal: typeof search.goal === "string" && search.goal.trim() ? search.goal : undefined,
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { goal } = Route.useSearch();
  return <OnboardingFlow initialGoal={goal} />;
}
