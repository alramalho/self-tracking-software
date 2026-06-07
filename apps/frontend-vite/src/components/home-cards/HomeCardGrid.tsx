import { usePlans } from "@/contexts/plans";
import { useMetrics } from "@/contexts/metrics";
import { useDataNotifications } from "@/contexts/notifications";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useAI } from "@/contexts/ai";
import { useCoachAttentionItems } from "@/components/CoachAttentionBanner";
import { getPendingCoachActionNotifications } from "@/utils/coachNotifications";
import { isAfter } from "date-fns";
import { CoachCard } from "./CoachCard";
import { PlanCard } from "./PlanCard";
import { MetricsCard } from "./MetricsCard";
import { GreetingCard } from "./GreetingCard";
import { UpcomingSessionsCard } from "./UpcomingSessionsCard";
import { useCurrentUser } from "@/contexts/users";

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
  const { currentUser } = useCurrentUser();

  const isUserOnFreePlan = userPlanType === "FREE";
  const showCoachCard =
    !isUserOnFreePlan &&
    isUserAIWhitelisted &&
    currentUser?.proactiveCoachingEnabled !== false;
  const coachAttentionItems = useCoachAttentionItems(showCoachCard);

  const activePlans = plans?.filter(
    (plan) =>
      plan.deletedAt === null &&
      !plan.archivedAt &&
      (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
  );
  const pendingCoachNotifications = getPendingCoachActionNotifications(notifications);

  const cards: HomeGridCard[] = [];

  if (showCoachCard) {
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
          coachAttentionItems={coachAttentionItems}
        />
      ),
      span: coachAttentionItems.length > 0 ? 2 : 1,
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
      {cards.map((card, index) => (
        <div
          key={index}
          className={card.span === 2 ? "col-span-2" : "col-span-1"}
        >
          {card.node}
        </div>
      ))}
    </div>
  );
};
