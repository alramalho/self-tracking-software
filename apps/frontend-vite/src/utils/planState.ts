import {
  AlertTriangle,
  CircleCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { PlanState } from "@tsw/prisma";

export interface PlanStateVisuals {
  Icon: LucideIcon;
  message: string;
  /** color for the status icon, e.g. "text-green-500" */
  colorClass: string;
  /** muted background tint for ghost cells of this state */
  tintBgClass: string;
  /** border tint for ghost cells of this state */
  tintBorderClass: string;
}

const VISUALS: Record<string, PlanStateVisuals> = {
  ON_TRACK: {
    Icon: TrendingUp,
    message: "On track!",
    colorClass: "text-green-500",
    tintBgClass: "bg-green-100 dark:bg-green-900/30",
    tintBorderClass: "border-green-400/60",
  },
  AT_RISK: {
    Icon: AlertTriangle,
    message: "At risk",
    colorClass: "text-amber-500",
    tintBgClass: "bg-amber-100 dark:bg-amber-900/30",
    tintBorderClass: "border-amber-400/60",
  },
  FAILED: {
    Icon: TrendingDown,
    message: "Off track!",
    colorClass: "text-red-500",
    tintBgClass: "bg-red-100 dark:bg-red-900/30",
    tintBorderClass: "border-red-400/60",
  },
  COMPLETED: {
    Icon: CircleCheck,
    message: "Week completed!",
    colorClass: "text-green-500",
    tintBgClass: "bg-green-100 dark:bg-green-900/30",
    tintBorderClass: "border-green-400/60",
  },
};

export function getPlanStateVisuals(
  state: PlanState | null | undefined
): PlanStateVisuals | null {
  if (!state) return null;
  return VISUALS[state] ?? null;
}
