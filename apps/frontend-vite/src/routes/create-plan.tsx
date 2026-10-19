import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { OnboardingRouteSearch } from "@/components/onboarding/types";
import { createFileRoute } from "@tanstack/react-router";

// Creating a plan inside the app: the same coach-designed flow as onboarding, without the welcome.
// The manual wizard lives at /create-plan-advanced ("Create a plan by hand").
export const Route = createFileRoute("/create-plan")({
  validateSearch: (search: Record<string, unknown>): OnboardingRouteSearch => ({
    goal: typeof search.goal === "string" && search.goal.trim() ? search.goal : undefined,
  }),
  component: CreatePlanPage,
});

function CreatePlanPage() {
  const { goal } = Route.useSearch();
  return <OnboardingFlow initialGoal={goal} flow="create" />;
}
