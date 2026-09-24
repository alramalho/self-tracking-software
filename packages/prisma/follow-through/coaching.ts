/** Stored alongside a plan's existing follow-through agreement. Absent means legacy behavior. */
export interface PlanCoaching {
  role: "tracking" | "consistency" | "training";
  followUps: boolean;
  dataAccess: { workouts: boolean; sleep: boolean };
}
export interface CoachRequest {
  id: string;
  planIds: string[];
  kind: "setup" | "review" | "difficulty" | "session" | "lapse" | "conversation";
  messageId?: string;
  chatId?: string;
  createdAt: string;
  requiresReply: boolean;
  reminderAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  entryId?: string;
  sessionId?: string;
}
export interface CoachMonitoringState {
  requests: CoachRequest[];
  reviewed: Record<string, string>;
  consideredEntries: Record<string, string>;
  pausedPlanIds: string[];
  /** Consistency plans that went quiet: the coach owes one "why you started / archive?" message. */
  lapsePlanIds?: string[];
  setupPlanIds?: string[];
  outreachPaused?: boolean;
  lastOutreachAt?: string;
  lastExtraAt?: string;
  viewingUntil?: string;
  lease?: { id: string; until: string };
}
