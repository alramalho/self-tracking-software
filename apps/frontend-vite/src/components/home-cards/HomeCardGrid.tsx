import { usePlans } from "@/contexts/plans";
import { useMetrics } from "@/contexts/metrics";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useAI } from "@/contexts/ai";
import { isAfter } from "date-fns";
import { CoachCard } from "./CoachCard";
import { PlanCard } from "./PlanCard";
import { MetricsCard } from "./MetricsCard";
import { GreetingCard } from "./GreetingCard";

interface HomeCardGridProps {
  onOpenMetricsLog: () => void;
}

export const HomeCardGrid = ({ onOpenMetricsLog }: HomeCardGridProps) => {
  const { plans } = usePlans();
  const { metrics } = useMetrics();
  const { userPlanType } = usePaidPlan();
  const { isUserAIWhitelisted } = useAI();

  const isUserOnFreePlan = userPlanType === "FREE";

  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      !plan.archivedAt &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );

  const plansNeedingAttention =
    activePlans?.filter((plan) =>
      ["AT_RISK", "FAILED"].includes(plan.currentWeekState || "")
    ) ?? [];

  const cards: React.ReactNode[] = [];

  if (!isUserOnFreePlan && isUserAIWhitelisted) {
    cards.push(
      <CoachCard key="coach" attentionCount={plansNeedingAttention.length} />
    );
  }

  activePlans?.forEach((plan) => {
    cards.push(<PlanCard key={plan.id} plan={plan} />);
  });

  if (metrics && metrics.length > 0 && !isUserOnFreePlan) {
    cards.push(<MetricsCard key="metrics" onLogClick={onOpenMetricsLog} />);
  }

  if (cards.length > 0 && cards.length % 2 !== 0) {
    cards.push(<GreetingCard key="greeting" />);
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards}
    </div>
  );
};
