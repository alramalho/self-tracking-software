import type { CoachItem as SharedCoachItem, PlanAlert as SharedPlanAlert } from "@tsw/prisma/follow-through/coach-inbox";
import type { Metric, Plan } from "@/core/types";
import type { CoachAttentionItem } from "@/features/messages/types";
import type { ReactNode } from "react";

/** Everything the coach is waiting on you for, with this app's plan, attention and metric types. */
export type CoachItem = SharedCoachItem<Plan, CoachAttentionItem, Metric>;
export type PlanAlert = SharedPlanAlert<Plan>;

export interface CoachingSwitches {
  ready: boolean;
  /** False for free accounts: the server refuses coaching without Plus. */
  canCoach: boolean;
  master: boolean;
  setMaster: (on: boolean) => void;
  /** The plan's own choice, kept while the master switch is off. */
  planOn: (planId: string) => boolean;
  canChangePlan: boolean;
  setPlan: (plan: Plan, on: boolean) => void;
  busy: boolean;
  error: unknown;
  /** Render where setPlan is used: the AI consent sheet. */
  consentSheet: ReactNode;
}


export interface CoachItemDrawerProps {
  item?: CoachItem;
  onClose: () => void;
  /** The daily check-in opens the metric logger. */
  onCheckIn?: () => void;
}

export interface CoachRowProps {
  item: CoachItem;
  onPress: () => void;
}

export interface SectionLabelProps {
  children: string;
}

/** How a coach conversation opens from a drawer: an optional prompt (sent or left for the user), the plan, and whether it answers a missed week. */
export type CoachChatOpening = { prompt?: string; send?: boolean; planId?: string; answersMiss?: boolean };
