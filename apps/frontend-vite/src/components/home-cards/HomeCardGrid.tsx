import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useActivities } from "@/contexts/activities/useActivities";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { subDays } from "date-fns";
import { CoachUpgradeCard } from "./CoachUpgradeCard";
import { CirclePreviewCard } from "./CirclePreviewCard";
import { useMyCircles } from "@/components/circles/api";
import { GreetingCard } from "./GreetingCard";

type HomeGridCard = {
  node: React.ReactNode;
  span: 1 | 2;
};

export const HomeCardGrid = () => {
  const { activityEntries, isLoadingActivityEntries } = useActivities();
  const { userPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const { data: circles } = useMyCircles();

  const isUserOnFreePlan = userPlanType === "FREE";
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

  // Plans live in the two weeks above the grid; a circle keeps its own card.
  circles?.forEach((circle) => {
    cards.push({
      node: <CirclePreviewCard key={`circle-${circle.id}`} circle={circle} />,
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
