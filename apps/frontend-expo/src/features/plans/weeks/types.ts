import type {
  PlanWeekCompletedCell,
  PlanWeekFlexibleCell,
  PlanWeekScheduledSession,
} from "@tsw/prisma/plan-week";
import type { PlanDayCells } from "@tsw/prisma/follow-through/coach-inbox";
import type { ActivityEntry, Plan, PlanSession } from "@/core/types";

export type PlanDay = PlanDayCells<
  PlanWeekScheduledSession & Pick<PlanSession, "title" | "targets">,
  PlanWeekFlexibleCell,
  PlanWeekCompletedCell
>;

export interface PlanWeeksProps {
  plan: Plan;
  entries: ActivityEntry[];
  own: boolean;
}

export interface DayTileProps {
  day: PlanDay;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}
