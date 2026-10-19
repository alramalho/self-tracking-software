import type { LucideIcon } from "lucide-react";
import type { PlanDayCells } from "@tsw/prisma/follow-through/coach-inbox";
import type {
  PlanWeekCompletedCell,
  PlanWeekFlexibleCell,
  PlanWeekScheduledSession,
} from "@tsw/prisma/plan-week";
import type { SessionTargets } from "@tsw/prisma/follow-through";
import type { CompletePlan } from "@/contexts/plans";

export type PlanDay = PlanDayCells<
  PlanWeekScheduledSession & { title?: string | null; targets?: unknown },
  PlanWeekFlexibleCell,
  PlanWeekCompletedCell
>;

export interface PlanWeeksProps {
  plan: CompletePlan;
  entries: { activityId?: string | null; datetime: Date | string; deletedAt?: Date | string | null }[];
  own: boolean;
}

export interface DayTileProps {
  day: PlanDay;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}

export interface TargetRowProps {
  icon: LucideIcon;
  children: string;
}

export interface SessionTargetRowsProps {
  targets: SessionTargets;
}
