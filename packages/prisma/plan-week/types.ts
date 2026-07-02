export type PlanWeekOutlineType = "SPECIFIC" | "TIMES_PER_WEEK" | string;

export type PlanWeekActivity = {
  id: string;
  title: string;
  emoji?: string | null;
  measure?: string | null;
};

export type PlanWeekSession = {
  id?: string;
  date: Date | string;
  activityId: string;
  quantity?: number | null;
  descriptiveGuide?: string | null;
  imageUrls?: string[] | null;
};

export type PlanWeekPlan = {
  id: string;
  goal: string;
  emoji?: string | null;
  outlineType?: PlanWeekOutlineType | null;
  timesPerWeek?: number | null;
  finishingDate?: Date | string | null;
  currentWeekState?: string | null;
  activities?: PlanWeekActivity[];
  sessions?: PlanWeekSession[];
};

export type PlanWeekEntry = {
  activityId?: string | null;
  datetime: Date | string;
};

export type PlanWeekFlexibleCellKind = "ghost" | "overflow";

export type PlanWeekFlexibleCell = {
  date: Date;
  dateKey: string;
  activityId: string;
  planId: string;
  title: string;
  emoji?: string | null;
  kind: PlanWeekFlexibleCellKind;
  state?: string | null;
};

export type PlanWeekCompletedCell = {
  date: Date;
  dateKey: string;
  activityId: string;
  planId: string;
  title?: string;
  emoji?: string | null;
};

export type PlanWeekScheduledSession = PlanWeekSession & {
  date: Date;
  dateKey: string;
  planId: string;
  planTitle: string;
  planEmoji?: string | null;
};

export type PlanWeekSummaryStatus =
  | "completed"
  | "on_track"
  | "at_risk"
  | "overloaded";

export type PlanWeekSummary = {
  planId: string;
  planGoal: string;
  planEmoji?: string | null;
  outlineType?: PlanWeekOutlineType | null;
  weekIndex: number;
  weekStartKey: string;
  weekEndKey: string;
  target: number;
  completedDays: number;
  remaining: number;
  openDays: number;
  overflow: number;
  slackDays: number;
  status: PlanWeekSummaryStatus;
  completedDateKeys: string[];
};

export type PlanWeekProjection = {
  weekStartKey: string;
  todayKey: string;
  scheduledSessions: PlanWeekScheduledSession[];
  flexibleCells: PlanWeekFlexibleCell[];
  completedCells: PlanWeekCompletedCell[];
  activities: PlanWeekActivity[];
  summaries: PlanWeekSummary[];
};

export type PlanWeekProjectionInput = {
  plans: PlanWeekPlan[];
  entries: PlanWeekEntry[];
  now: Date;
  timezone?: string | null;
  weekCount?: number;
};
