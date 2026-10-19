import type { CoachCheck, CoachRequest, FollowThroughState, PlanSupport } from "@tsw/prisma/follow-through";
import type { MissedWeek } from "@tsw/prisma/follow-through/streak";
import type { ActivityEntry, Metric, Plan } from "@/core/types";
import type { CoachAttentionItem } from "@/features/messages/types";
import type { ReactNode } from "react";

/** How a coached plan needs you, as the home card and the Coach tab both show it. */
export interface PlanAlert {
  plan: Plan;
  status: "quiet" | "at_risk" | "missed";
  quietDays: number;
  /** Sessions still needed this week, and days left to fit them. */
  needed: number;
  daysLeft: number;
  missed: MissedWeek | null;
  /** The coach's silent "gone quiet" message, when it sent one. */
  nudge?: CoachRequest;
}

export interface PlanAlertInput {
  plan: Plan;
  entries: ActivityEntry[];
  state?: FollowThroughState;
  now?: Date;
}

interface ItemBase {
  id: string;
  /** One short line for the Recent row. */
  title: string;
  /** What kind of thing it is, shown under the title. */
  label: string;
  emoji: string;
  at: string;
}

/** Everything the coach is waiting on you for, as one list. */
export type CoachItem =
  | (ItemBase & { kind: "alert"; alert: PlanAlert })
  | (ItemBase & { kind: "request"; request: CoachRequest; plan?: Plan })
  | (ItemBase & { kind: "check"; check: CoachCheck; plan?: Plan })
  | (ItemBase & { kind: "attention"; attention: CoachAttentionItem })
  | (ItemBase & { kind: "checkin"; metrics: Metric[] });

export interface CoachItemsInput {
  plans: Plan[];
  entries: ActivityEntry[];
  state?: FollowThroughState;
  attention: CoachAttentionItem[];
  metrics: Metric[];
  checkedInToday: boolean;
  /** Plans whose missed week was already answered on this device. */
  answeredMisses: string[];
  now?: Date;
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

export interface SupportChange {
  support: PlanSupport;
  /** The plan is paused by the coach and needs resuming too. */
  resume: boolean;
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
