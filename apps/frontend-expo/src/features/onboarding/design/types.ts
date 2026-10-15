import type { CoachNote, DesignActivity, DesignOption, DesignSession, PlanDesign } from "@tsw/prisma/follow-through";

export interface DesignSectionProps {
  design: PlanDesign;
  goal: string;
  goalReason: string;
  timezone: string;
  preview: boolean;
  busy: boolean;
  /** Persist progress so the person can leave and come back. */
  onChange: (design: PlanDesign) => Promise<void> | void;
  /** Back from the first design screen returns to the previous interview question. */
  onBack: () => void;
  onClose: () => void;
  onDone: (design: PlanDesign) => void;
}

export type DesignStepName = "subgoal" | "days" | "loading" | "ask" | "pushback" | "retarget" | "options" | "preview";

export interface RouteCardProps {
  option: DesignOption;
  selected?: boolean;
  onPress: () => void;
}

export interface TwoWeeksProps {
  sessions: DesignSession[];
  activity: DesignActivity;
  startDate: string;
}

export interface SessionDetailProps {
  session: DesignSession;
  activity: DesignActivity;
}

export interface ClassifyResponse {
  orientation: PlanDesign["orientation"];
  reason: string;
  activity: { key: string; title: string; measure: string; emoji: string };
  goalSpec: PlanDesign["goalSpec"];
  baselineQuestion: string;
}

export interface OptionsResponse {
  status: "READY" | "ASK" | "PUSHBACK";
  question: string | null;
  coachNote: CoachNote | null;
  baseline: PlanDesign["baseline"];
  options: DesignOption[];
  startDate: string;
}

/** The smaller plan offered when the person isn't sure of the one they picked. */
export type LighterPlan =
  | { kind: "other-route"; route: DesignOption["id"]; daysMin: number; daysMax: number }
  | { kind: "fewer-days"; days: number };

export interface ConfidenceSectionProps {
  design: PlanDesign;
  progress: { current: number; total: number; label: string };
  preview: boolean;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  /** The design with `confidence` set, and the lighter plan applied when the person took it. */
  onDone: (design: PlanDesign) => void;
}

export type ConfidenceStepName = "rate" | "lighter" | "why";

export interface ConfidenceDialProps {
  score: number;
  onChange?: (score: number) => void;
  /** Smaller and read-only, shown above the "why" question. */
  compact?: boolean;
  /** 0–1 while the person is speaking; the dial glows with their voice. */
  voice?: number;
}
