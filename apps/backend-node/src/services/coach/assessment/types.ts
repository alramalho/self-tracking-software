import type { PlanWeekEntry, PlanWeekPlan } from "@tsw/prisma/plan-week";

export type CoachContextBriefCandidate = {
  type:
    | "INACTIVITY_ARCHIVE_PROPOSAL"
    | "INACTIVITY_PAUSE_PROPOSAL"
    | "PLAN_ADJUSTMENT"
    | "WEEK_PREP"
    | "SESSION_PREP"
    | "WEEK_RECAP"
    | "INACTIVITY_CHECKIN"
    | "CELEBRATION";
  planIds: string[];
};

export type PlanMotivatorInsight = {
  planId: string;
  goal: string;
  selectedReason: string | null;
  discardedReasons: string[];
};

export type DifficultyPatternInsight = {
  planId: string;
  goal: string;
  totalReports: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  latestDifficulty: string | null;
  severity: "easy" | "hard" | "mixed";
  summary: string;
};

export type MetricsLoggingGapInsight = {
  metricCount: number;
  entriesInLookback: number;
  daysSinceLastLog: number | null;
  shouldNudge: boolean;
  summary: string;
};

export type CoachContextBrief = {
  planMotivators: PlanMotivatorInsight[];
  difficultyPatterns: DifficultyPatternInsight[];
  metricsLoggingGap: MetricsLoggingGapInsight | null;
};

export type SelectedCoachInsight = {
  kind: "goal_reason" | "difficulty_pattern" | "metrics_logging_gap";
  text: string;
} | null;

export type AssessmentWeeklyOverviewInput = {
  plans: PlanWeekPlan[];
  entries: PlanWeekEntry[];
  now: Date;
  timezone?: string | null;
};
