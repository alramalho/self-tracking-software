import type { PlanSupport } from "@tsw/prisma/follow-through";

export interface SupportPlanRecord {
  outlineType?: string;
  id: string;
  goal: string;
  emoji: string | null;
  timesPerWeek: number | null;
  finishingDate: Date | null;
  isPaused: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
  activities: {
    id: string;
    title: string;
    emoji: string;
    measure: string;
    deletedAt: Date | null;
  }[];
  sessions: {
    id: string;
    activityId: string;
    date: Date;
    quantity: number;
    descriptiveGuide: string;
  }[];
}
export interface PendingOutreach {
  id: string;
  planId: string;
  sessionId: string | null;
  checkId: string | null;
  title: string;
  body: string;
  dueAt: string;
}
export interface SupportUpdate {
  support: PlanSupport;
  now: Date;
}
export interface ClaimedOutreach extends PendingOutreach {
  notificationId: string;
  url: string;
}
export interface LoggedSessionEntry {
  id: string;
  activityId: string | null;
  datetime: Date;
  deletedAt: Date | null;
}
