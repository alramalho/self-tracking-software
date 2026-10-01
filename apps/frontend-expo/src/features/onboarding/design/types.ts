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
