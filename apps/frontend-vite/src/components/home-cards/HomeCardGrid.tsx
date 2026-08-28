import { usePlans } from "@/contexts/plans";
import { useMetrics } from "@/contexts/metrics";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useAI } from "@/contexts/ai";
import { useActivities } from "@/contexts/activities/useActivities";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { isAfter, startOfDay, subDays } from "date-fns";
import { CoachCard } from "./CoachCard";
import { CoachUpgradeCard } from "./CoachUpgradeCard";
import { PlanCard } from "./PlanCard";
import { MetricsCard } from "./MetricsCard";
import { GreetingCard } from "./GreetingCard";
import { UpcomingSessionsCard } from "./UpcomingSessionsCard";
import { useCurrentUser } from "@/contexts/users";
import { useMessages } from "@/contexts/messages";

interface HomeCardGridProps {
  onOpenMetricsLog: () => void;
}

type HomeGridCard = {
  node: React.ReactNode;
  span: 1 | 2;
};

const UNORDERED_PLAN_SORT = Number.MAX_SAFE_INTEGER;

export const HomeCardGrid = ({ onOpenMetricsLog }: HomeCardGridProps) => {
  const { plans } = usePlans();
  const { activityEntries, isLoadingActivityEntries } = useActivities();
  const { metrics } = useMetrics();
  const { userPlanType } = usePaidPlan();
  const { isUserAIWhitelisted } = useAI();
  const { currentUser } = useCurrentUser();
  const { chats } = useMessages();
  const { setShowUpgradePopover } = useUpgrade();

  const isUserOnFreePlan = userPlanType === "FREE";
  const canUseCoach =
    !isUserOnFreePlan &&
    isUserAIWhitelisted &&
    currentUser?.proactiveCoachingEnabled !== false;

  // Plans past their finishingDate stay visible so they cannot be silently
  // abandoned: they show as needing a decision until renewed or archived.
  const activePlans = plans?.filter(
    (plan) => plan.deletedAt === null && !plan.archivedAt
  );
  const orderedActivePlans = activePlans
    ? [...activePlans].sort((a, b) => {
        const orderA = a.sortOrder ?? UNORDERED_PLAN_SORT;
        const orderB = b.sortOrder ?? UNORDERED_PLAN_SORT;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : undefined;
  const todayStart = startOfDay(new Date());
  const planNeedsAttention = (plan: NonNullable<typeof activePlans>[number]) =>
    (plan.finishingDate !== null &&
      isAfter(todayStart, new Date(plan.finishingDate))) ||
    (plan.outlineType === "SPECIFIC" &&
      !(plan.sessions || []).some(
        (session) => !isAfter(todayStart, new Date(session.date))
      ));
  const latestCoachMessage = chats?.find(
    (chat) => chat.type === "COACH"
  )?.latestCoachMessage;
  const recentActivityCount = activityEntries.filter((entry) => {
    const datetime = new Date(entry.datetime);
    return datetime >= subDays(new Date(), 30);
  }).length;

  const cards: HomeGridCard[] = [];

  if (
    isUserOnFreePlan &&
    !isLoadingActivityEntries &&
    recentActivityCount <= 5
  ) {
    cards.push({
      node: (
        <CoachUpgradeCard
          key="coach-upgrade"
          onOpenUpgrade={() => setShowUpgradePopover(true)}
          recentActivityCount={recentActivityCount}
        />
      ),
      span: 2,
    });
  }

  if (canUseCoach && latestCoachMessage?.isUnread) {
    cards.push({
      node: (
        <CoachCard
          key="coach"
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
  if (orderedActivePlans?.some((plan) => plan.outlineType === "SPECIFIC" && (plan.sessions || []).length > 0)) {
    cards.push({
      node: <UpcomingSessionsCard key="upcoming-sessions" plans={orderedActivePlans} />,
      span: 2,
    });
  }

  orderedActivePlans
    ?.filter(
      (plan) =>
        plan.outlineType === "TIMES_PER_WEEK" || planNeedsAttention(plan)
    )
    .forEach((plan) => {
      cards.push({
        node: (
          <PlanCard
            key={plan.id}
            plan={plan}
            activityEntries={activityEntries}
          />
        ),
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
