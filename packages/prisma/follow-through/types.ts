export type * from "./coaching";
export type CommitmentMode = "WEEKLY" | "DAYS" | "TIMED";
export type SessionFormat = "LOG" | "TIMER" | "RESOURCE";
export interface SupportPreferences {
  coaching: boolean;
  reminder: boolean;
  reminderMinutes: number;
  dayReminderTime: string;
  checkIn: boolean;
  checkInTime: string;
  weeklyReview: boolean;
  reviewDay: number;
  reviewTime: string;
}
export interface PlanSupport {
  coaching?: import("./coaching").PlanCoaching;
  planId: string;
  mode: CommitmentMode;
  weekdays: number[];
  time: string | null;
  timezone: string;
  /** Default timer/reminder length for follow-through tools, not a plan prescription. */
  durationMinutes: number;
  format: SessionFormat;
  resourceUrl: string | null;
  resourceName: string | null;
  nextStep: string;
  preferences: SupportPreferences;
  effectiveDate: string;
}
export type SessionOutcome = "UNCONFIRMED" | "DONE" | "PARTLY" | "SKIPPED";
export interface PracticeSession {
  id: string;
  planId: string;
  activityId: string;
  date: string;
  time: string | null;
  timezone: string;
  durationMinutes: number;
  outcome: SessionOutcome;
  /** SKIPPED because the coach asked and got no reply, not because the person said so. */
  assumedMissed?: boolean;
  entryId: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  timerRunning: boolean;
  movedFrom?: string;
  source: "EXISTING" | "RECURRING" | "SPONTANEOUS";
}
export interface CoachCheck {
  id: string;
  planId: string;
  sessionId: string | null;
  kind: "SESSION" | "WEEKLY";
  dueAt: string;
  sentAt: string | null;
  claimedAt?: string | null;
  answeredAt: string | null;
  dismissedAt: string | null;
  message: string;
}
export interface OnboardingAnswer {
  question: string;
  answer: string;
  use: string;
}
export type InterviewStage =
  | "goal"
  | "baseline"
  | "motivation"
  | "rhythm"
  | "support"
  | "review";
export interface InterviewQuestion {
  title: string;
  purpose: string;
  options: string[];
}
export interface InterviewCheck {
  label: string;
  passed: boolean;
  detail: string;
  /** Hard requirements block the gate; useful-to-have checks do not. */
  required?: boolean;
}
export interface InterviewTurn {
  stage: InterviewStage;
  question: string;
  answer: string;
  feedback: string;
  accepted: boolean;
}
/** Facts gathered during clarification; session-level prescriptions belong to a later plan design. */
export interface InterviewFacts {
  goal: string;
  goalReason: string;
  baseline: string;
  emoji: string;
  activityTitle: string;
  measure: string;
  frequency: number;
  /**
   * Legacy transport field kept optional while older clients roll forward. The
   * clarification contract does not use or prescribe it.
   */
  durationMinutes?: number;
  commitment: CommitmentMode;
  weekdays: number[];
  time: string | null;
  targetDate: string | null;
  resourceName: string;
  resourceUrl: string;
  nextStep: string;
  recommendation: "coaching" | "tracking";
  coachingRole?: "consistency" | "training";
  recommendationReason: string;
  wantsCoaching: boolean;
}
export interface InterviewState {
  version: 1;
  stage: InterviewStage;
  question: InterviewQuestion;
  pending?: InterviewResult;
  turns: InterviewTurn[];
  facts: InterviewFacts;
  confirmed: InterviewStage[];
}
export interface InterviewResult {
  accepted: boolean;
  /** True when the answer can continue but would benefit from one optional detail. */
  needsImprovement?: boolean;
  summary: string;
  checks: InterviewCheck[];
  question: InterviewQuestion;
  nextQuestion: InterviewQuestion;
  facts: InterviewFacts;
}
export interface GoalGuidanceRequirement {
  key: string;
  label: string;
  phrase: string;
  required: boolean;
  passed: boolean;
  detail: string;
}
export interface GoalGuidanceResult {
  requirements: GoalGuidanceRequirement[];
}
export interface OnboardingDraft {
  coaching?: import("./coaching").PlanCoaching;
  interview?: InterviewState;
  awaitingUpgrade?: boolean;
  id: string;
  goal: string;
  emoji: string;
  activityId: string | null;
  activityTitle: string;
  measure: string;
  commitment: CommitmentMode;
  frequency: number;
  weekdays: number[];
  time: string | null;
  /** Legacy/default follow-through timer setting, independent of interview facts. */
  durationMinutes: number;
  timezone: string;
  targetDate: string | null;
  resourceName: string;
  resourceUrl: string;
  nextStep: string;
  format: SessionFormat;
  wantsCoaching: boolean;
  answers: OnboardingAnswer[];
  step: string;
  createdPlanId: string | null;
  preferences?: SupportPreferences;
}
export interface FollowThroughState {
  monitoring?: import("./coaching").CoachMonitoringState;
  version: 1;
  enabled: boolean;
  pausedAt: string | null;
  supports: Record<string, PlanSupport>;
  sessions: Record<string, PracticeSession>;
  checks: Record<string, CoachCheck>;
  draft: OnboardingDraft | null;
}
export interface FollowThroughSnapshot {
  state: FollowThroughState;
  canCoach: boolean;
  serverTime: string;
}
export interface CalendarSession {
  sessionId: string;
  planId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeZone: string;
  url: string;
}
