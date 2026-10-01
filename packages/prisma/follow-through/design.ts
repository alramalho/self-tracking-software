/**
 * What the coach understood and designed during onboarding, and what it keeps on the plan
 * afterwards so the same facts can regenerate the next weeks.
 */
export type PlanOrientation = "OUTCOME" | "CONSISTENCY";
export type RouteId = "steady" | "focused";

/** The person's own target. Nothing here is ever imposed by the coach. */
export interface GoalSpec {
  /** e.g. FINISH_TIME, LIFT_LOAD, BODY_WEIGHT, BODY_MEASURE, SONG, CONVERSATION. Null = finish/complete only. */
  metric: string | null;
  value: number | null;
  unit: string | null;
  /** The target in the person's words, e.g. "under 2 hours" or "60 kg for 5 reps". */
  text: string | null;
  chosenByUser: boolean;
}

export interface BaselineMeasurement {
  metric: string;
  value: number;
  unit: string;
  /** Exact words the number came from, so nothing is invented. */
  sourceQuote: string;
}

export interface DesignBaseline {
  /** Verbatim. The generator always receives this, never a category. */
  text: string;
  measurements: BaselineMeasurement[];
}

export interface DesignActivity {
  key: string;
  title: string;
  measure: string;
  emoji: string;
}

export interface SessionPace {
  minSecondsPerKm: number | null;
  maxSecondsPerKm: number | null;
  /** UNKNOWN keeps the numbers null: a pace is never invented. */
  basis: "USER_REPORTED_EASY_PACE" | "PERFORMANCE_ESTIMATE" | "UNKNOWN";
  evidence: string | null;
}

/** The measurable part of a session. Stored as JSON on the plan session. */
export interface SessionTargets {
  durationMinutes: number;
  effort: string;
  pace: SessionPace | null;
  exercise: string | null;
  sets: number | null;
  reps: number | null;
  loadKg: number | null;
  restSeconds: number | null;
  /** What the person should notice or log to know the session worked. */
  progressMeasure: string;
}

export interface DesignSession {
  date: string;
  activity: string;
  quantity: number;
  title: string;
  descriptiveGuide: string;
  targets: SessionTargets;
}

export interface DesignPhase {
  title: string;
  startWeek: number;
  endWeek: number;
  progressCheck: string;
}

export interface DesignOption {
  id: RouteId;
  coach: "Helly" | "Oli";
  /** Days a week, as a range (Garmin-style "3–4"). The first two weeks sit inside it. */
  daysMin: number;
  daysMax: number;
  estimatedWeeks: number;
  finishingDate: string;
  rationale: string;
  assumptions: string[];
  phases: DesignPhase[];
  /** Only the first 14 days. Later weeks are designed as the person progresses. */
  sessions: DesignSession[];
}

export interface SubgoalQuestion {
  kind: string;
  title: string;
  /** 2–4 short taps. A typed answer is always allowed. */
  choices: string[];
}

export interface PlanDesign {
  orientation: PlanOrientation;
  goalSpec: GoalSpec;
  baseline: DesignBaseline;
  activities: DesignActivity[];
  /** The days the person would like. An anchor, not a command: the coach may adjust it or push back. */
  preferredDays: number;
  /** What the coach said about the preference. Null until the coach has looked. */
  coachNote: CoachNote | null;
  fixedDate: string | null;
  /** Questions already asked, so the coach never repeats one. */
  asked: { question: string; answer: string }[];
  options: DesignOption[];
  selected: RouteId | null;
  startDate: string;
}

/** Stored on Plan.outline: the whole road, with only the near part dated. */
export interface PlanOutline {
  route: RouteId;
  coach: "Helly" | "Oli";
  phases: DesignPhase[];
  assumptions: string[];
  daysMin: number;
  daysMax: number;
  startDate: string;
  estimatedWeeks: number;
}

export type DesignVerdict = "FITS" | "ADJUSTED" | "PUSHBACK";

/** The coach's honest read of the person's preferred days against their goal and starting point. */
export interface CoachNote {
  verdict: DesignVerdict;
  /** Shown to the person. Always present for ADJUSTED and PUSHBACK. */
  message: string | null;
  /** For PUSHBACK: the fewest days that could work, offered as one tap. */
  suggestedDays: number | null;
  /** For PUSHBACK: whether the person's own target is part of the problem (so "change my target" makes sense). */
  targetInvolved: boolean;
}

export interface ClassifyResult {
  orientation: PlanOrientation;
  reason: string;
  activity: { title: string; measure: string; emoji: string };
  goalSpec: GoalSpec;
  baselineQuestion: string;
}
