import type {
  CoachItem as SharedCoachItem,
  PlanAlert as SharedPlanAlert,
  UpcomingCheckIn as SharedUpcomingCheckIn,
} from "@tsw/prisma/follow-through/coach-inbox";
import type { Metric, Plan } from "@/core/types";
import type { CoachAttentionItem } from "@/features/messages/types";
import type { ReactNode } from "react";

/** Everything the coach is waiting on you for, with this app's plan, attention and metric types. */
export type CoachItem = SharedCoachItem<Plan, CoachAttentionItem, Metric>;
export type PlanAlert = SharedPlanAlert<Plan>;
/** A check-in the coach booked, shown under "Coming up". */
export type UpcomingCheckIn = SharedUpcomingCheckIn<Plan>;

export interface UpcomingRowProps {
  checkIn: UpcomingCheckIn;
  onPress: () => void;
}

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

/** How the full coach chat opens from a drawer: an optional prompt left in the composer, never sent for the user. */
export type CoachChatOpening = { prompt?: string; planId?: string };

export interface CoachSettingsProps {
  visible: boolean;
  onClose: () => void;
}
