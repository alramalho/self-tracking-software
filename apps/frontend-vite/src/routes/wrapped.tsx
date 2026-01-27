import { YearWrapped } from "@/components/YearWrapped";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { useCurrentUser } from "@/contexts/users";
import { usePlans } from "@/contexts/plans";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/wrapped")({
  component: WrappedPage,
});

function WrappedPage() {
  const navigate = useNavigate();
  const { currentUser, isLoadingCurrentUser } = useCurrentUser();
  const { entries: metricEntries, isLoadingEntries: isLoadingMetrics } = useMetrics();
  const { activities, activityEntries, isLoadingActivities } = useActivities();
  const { plans, isLoadingPlans } = usePlans();

  const isLoading = isLoadingCurrentUser || isLoadingMetrics || isLoadingActivities || isLoadingPlans;

  // Default to 2025, could make this dynamic
  const year = 2025;

  const handleClose = () => {
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!currentUser) {
    navigate({ to: "/signin", search: { redirect_url: "/wrapped" } });
    return null;
  }

  // Transform plans to match expected format
  const plansWithProgress = plans?.map((plan) => ({
    id: plan.id,
    emoji: plan.emoji,
    goal: plan.goal,
    progress: plan.progress,
  })) || [];

  return (
    <YearWrapped
      year={year}
      metricEntries={metricEntries || []}
      activityEntries={activityEntries || []}
      activities={activities || []}
      plans={plansWithProgress}
      onClose={handleClose}
    />
  );
}
