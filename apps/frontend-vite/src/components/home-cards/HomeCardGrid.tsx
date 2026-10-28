import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useActivities } from "@/contexts/activities/useActivities";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { subDays } from "date-fns";
import { CoachUpgradeCard } from "./CoachUpgradeCard";

// Under the two weeks, the homepage only offers the coach to free accounts that are just starting.
export const HomeCardGrid = () => {
  const { activityEntries, isLoadingActivityEntries } = useActivities();
  const { userPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  const recentActivityCount = activityEntries.filter(
    (entry) => new Date(entry.datetime) >= subDays(new Date(), 30)
  ).length;

  if (userPlanType !== "FREE" || isLoadingActivityEntries || recentActivityCount > 5) return null;

  return (
    <CoachUpgradeCard
      onOpenUpgrade={() => setShowUpgradePopover(true)}
      recentActivityCount={recentActivityCount}
    />
  );
};
