import type { PlanWeekProjection } from "../plan-week/types";

export type HomeItemKind = "scheduled" | "flexible" | "done";

/** One thing on a day of the homepage's two weeks, from any plan. */
export type HomeDayItem = {
  id: string;
  planId: string;
  planGoal: string;
  activityId: string;
  title: string;
  emoji: string;
  kind: HomeItemKind;
  quantity?: number | null;
  measure?: string | null;
  /** Flexible slots only: sessions still open that week. */
  remaining?: number;
  /** The coach's practice session for this day, when there is one: it opens the session screen. */
  sessionId?: string;
  time?: string | null;
};

export type HomeDay = {
  key: string;
  isToday: boolean;
  isPast: boolean;
  /** Still to do first, then flexible slots, then what is already done. */
  items: HomeDayItem[];
};

export type HomeDaysInput = {
  projection: PlanWeekProjection;
  plans: { id: string; goal: string; emoji?: string | null; activities?: { id: string }[] }[];
  entries: { activityId?: string | null; datetime: Date | string; deletedAt?: Date | string | null }[];
  /** The coach's practice sessions (iPhone only): they add a time and a session screen to a day. */
  practice?: { id: string; planId: string; activityId: string; date: string; time: string | null; outcome: string }[];
};

/** The parts of a Coach tab item the homepage note reads; both apps' items fit it. */
export type CoachNoteCandidate = {
  kind: "alert" | "request" | "check" | "attention" | "checkin";
  at: string;
  alert?: { status: "quiet" | "at_risk" | "missed"; nudge?: unknown };
};
