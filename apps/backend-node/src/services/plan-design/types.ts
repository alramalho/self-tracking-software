import type {
  ClassifyResult,
  CoachNote,
  DesignActivity,
  DesignBaseline,
  DesignOption,
  DesignPhase,
  DesignSession,
  GoalSpec,
  PlanOrientation,
  SubgoalQuestion,
} from "@tsw/prisma/follow-through";
import type { z } from "zod/v4";

export type Effort = "low" | "medium" | "high";

export interface GenerateObjectArgs<T extends z.ZodType> {
  name: string;
  schema: T;
  system: string;
  prompt: string;
  /** AI Gateway model id, e.g. openai/gpt-6-luna. */
  model: string;
  effort: Effort;
}

export interface GenerationUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd?: number;
}

/** One structured model call. The default talks to the AI Gateway; tests pass a fake. */
export type ObjectGenerator = <T extends z.ZodType>(
  args: GenerateObjectArgs<T>,
) => Promise<{ object: z.infer<T>; usage: GenerationUsage }>;

export interface ClassifyInput {
  goal: string;
  existingActivities: { title: string; measure: string }[];
}

export interface SubgoalInput {
  goal: string;
  orientation: PlanOrientation;
  goalSpec: GoalSpec;
  activity: DesignActivity | { title: string; measure: string };
  baseline: string;
  asked: { question: string; answer: string }[];
}

export interface DesignInput {
  goal: string;
  goalSpec: GoalSpec;
  baseline: string;
  activities: DesignActivity[];
  /** What the person asked for. The coach decides what the routes use. */
  preferredDays: number;
  fixedDate: string | null;
  asked: { question: string; answer: string }[];
  /** First day of the two-week window, YYYY-MM-DD in the person's timezone. */
  startDate: string;
}

export interface DesignResult {
  status: "READY" | "ASK" | "PUSHBACK";
  question: string | null;
  coachNote: CoachNote | null;
  /** What the validator rejected before the final answer, for the benchmark and for tuning prompts. */
  retried: string[];
  /** Models that produced the routes (more than one when the fallback stepped in). */
  models: string[];
  baseline: DesignBaseline;
  options: DesignOption[];
  usage: GenerationUsage[];
}

/** What the weekly review gives the generator to extend a coached outcome plan. */
export interface WindowInput {
  goal: string;
  goalSpec: GoalSpec | null;
  baseline: DesignBaseline | null;
  outline: {
    route: "steady" | "focused";
    coach: "Helly" | "Oli";
    phases: DesignPhase[];
    assumptions: string[];
    daysMin: number;
    daysMax: number;
    startDate: string;
    estimatedWeeks: number;
  };
  finishingDate: string | null;
  activities: (DesignActivity & { id: string })[];
  /** Sessions already on the plan. Completed or past ones are never replaced. */
  sessions: {
    id: string;
    date: string;
    activityId: string;
    quantity: number;
    title: string | null;
    targets: DesignSession["targets"] | null;
    completed: boolean;
  }[];
  /** What actually happened recently, from logs. */
  results: {
    date: string;
    activityId: string;
    quantity: number;
    difficulty: string | null;
    note: string | null;
  }[];
  /** Short, permitted summaries of watch workouts. Null when the person has not granted access. */
  approvedHealthContext: string | null;
  today: string;
  feedback: string | null;
}

export interface WindowResult {
  /** Upcoming, uncompleted sessions to delete before adding the new ones. */
  replaceSessionIds: string[];
  sessions: (Omit<DesignSession, "activity"> & { activityId: string })[];
  phases: DesignPhase[];
  summary: string;
  designedThrough: string;
  usage: GenerationUsage;
  /** Every call this window took, including a fallback model's. */
  calls?: GenerationUsage[];
}

export type { ClassifyResult, SubgoalQuestion };
