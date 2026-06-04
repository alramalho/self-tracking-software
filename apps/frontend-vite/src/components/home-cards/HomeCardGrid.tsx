import { usePlans } from "@/contexts/plans";
import { useMetrics } from "@/contexts/metrics";
import { useDataNotifications } from "@/contexts/notifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useAI } from "@/contexts/ai";
import { getPendingCoachActionNotifications } from "@/utils/coachNotifications";
import { isAfter } from "date-fns";
import { CoachCard } from "./CoachCard";
import { PlanCard } from "./PlanCard";
import { MetricsCard } from "./MetricsCard";
import { GreetingCard } from "./GreetingCard";
import { UpcomingSessionsCard } from "./UpcomingSessionsCard";

interface HomeCardGridProps {
  onOpenMetricsLog: () => void;
}

type HomeGridCard = {
  node: React.ReactNode;
  span: 1 | 2;
};

export const HomeCardGrid = ({ onOpenMetricsLog }: HomeCardGridProps) => {
  const { plans, isLoadingPlans } = usePlans();
  const { metrics } = useMetrics();
  const { notifications } = useDataNotifications();
  const { userPlanType } = usePaidPlan();
  const { isUserAIWhitelisted, lastCoachNoReportAt } = useAI();

  const isUserOnFreePlan = userPlanType === "FREE";

  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      !plan.archivedAt &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const pendingCoachNotifications = getPendingCoachActionNotifications(notifications);

  const cards: HomeGridCard[] = [];

  if (!isUserOnFreePlan && isUserAIWhitelisted) {
    const firstPendingPlanId = (pendingCoachNotifications[0]?.relatedData as any)?.planIds?.[0];
    cards.push({
      node: (
        <CoachCard
          key="coach"
          attentionCount={pendingCoachNotifications.length}
          activePlanCount={activePlans?.length ?? 0}
          isLoadingPlans={isLoadingPlans}
          reviewPlanId={firstPendingPlanId}
          lastCoachNoReportAt={lastCoachNoReportAt}
        />
      ),
      span: 1,
    });
  }


  if (metrics && metrics.length > 0 && !isUserOnFreePlan) {
    cards.push({
      node: <MetricsCard key="metrics" onLogClick={onOpenMetricsLog} />,
      span: 1,
    });
  }
  if (activePlans?.some((plan) => plan.outlineType === "SPECIFIC" && (plan.sessions || []).length > 0)) {
    cards.push({
      node: <UpcomingSessionsCard key="upcoming-sessions" plans={activePlans} />,
      span: 2,
    });
  }

  activePlans
    ?.filter((plan) => plan.outlineType === "TIMES_PER_WEEK")
    .forEach((plan) => {
      cards.push({
        node: <PlanCard key={plan.id} plan={plan} />,
        span: 1,
      });
    });

  const occupiedColumns = cards.reduce((total, card) => total + card.span, 0);

  if (cards.length > 0 && occupiedColumns % 2 !== 0) {
    cards.push({
      node: <GreetingCard key="greeting" />,
      span: 1,
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-flow-dense grid-cols-2 gap-3">
      {cards.map((card) => card.node)}
    </div>
  );
};
