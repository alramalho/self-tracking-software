import type { Metric } from "@tsw/prisma";
import type {
  CoachItem as SharedCoachItem,
  PlanAlert as SharedPlanAlert,
} from "@tsw/prisma/follow-through/coach-inbox";
import type { CompletePlan } from "@/contexts/plans";
import type { CoachAttentionItem } from "@/contexts/ai/types";

/** Everything the coach is waiting on you for, with the web app's plan, attention and metric types. */
export type CoachItem = SharedCoachItem<CompletePlan, CoachAttentionItem, Metric>;
export type PlanAlert = SharedPlanAlert<CompletePlan>;

export interface CoachingSwitches {
  ready: boolean;
  /** False for free accounts: the server refuses coaching without Plus. */
  canCoach: boolean;
  master: boolean;
  setMaster: (on: boolean) => void;
  /** The plan's own choice, kept while the master switch is off. */
  planOn: (planId: string) => boolean;
  canChangePlan: boolean;
  setPlan: (plan: CompletePlan, on: boolean) => void;
  busy: boolean;
  error: unknown;
}

export interface CoachItemDrawerProps {
  item?: CoachItem;
  onClose: () => void;
  /** The daily check-in opens the metric logger. */
  onCheckIn?: () => void;
}

export interface CoachRowProps {
  item: CoachItem;
  onClick: () => void;
}

export interface MissReason {
  label: string;
  says: string;
}

export interface SectionLabelProps {
  children: string;
}
