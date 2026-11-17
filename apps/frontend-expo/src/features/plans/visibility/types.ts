import type { PlanVisibilityChoice } from "@tsw/prisma/follow-through";
import type { Plan } from "@/core/types";

export type { PlanVisibilityChoice };

export interface VisibilityOption {
  value: PlanVisibilityChoice;
  label: string;
  description: string;
}

export interface PlanVisibilityChoicesProps {
  value: Plan["visibility"];
  onChange: (value: PlanVisibilityChoice) => void;
  /** This plan's activities, to warn when one also sits in a plan that shows its logs. */
  activityIds: string[];
  /** The plan being edited, left out of that check. */
  planId?: string;
}

export interface PlanVisibilityRowProps {
  value: PlanVisibilityChoice;
  onChange: (value: PlanVisibilityChoice) => void;
  activityIds: string[];
}
