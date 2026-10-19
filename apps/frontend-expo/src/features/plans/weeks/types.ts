import type {
  PlanWeekCompletedCell,
  PlanWeekFlexibleCell,
  PlanWeekScheduledSession,
} from "@tsw/prisma/plan-week";
import type { ActivityEntry, Plan, PlanSession } from "@/core/types";

export interface PlanDay {
  key: string;
  isToday: boolean;
  isPast: boolean;
  /** Any of the plan's activities was logged that day. */
  logged: boolean;
  done: PlanWeekCompletedCell[];
  scheduled: (PlanWeekScheduledSession & Pick<PlanSession, "title" | "targets">)[];
  flexible: PlanWeekFlexibleCell[];
}

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
