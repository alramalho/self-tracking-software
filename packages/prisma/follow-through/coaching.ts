/** Stored alongside a plan's existing follow-through agreement. Absent means legacy behavior. */
export interface PlanCoaching {
  role: "tracking" | "consistency" | "training";
  followUps: boolean;
  dataAccess: { workouts: boolean; sleep: boolean };
}
export interface CoachRequest {
  id: string;
  planIds: string[];
  kind: "setup" | "review" | "difficulty" | "session" | "lapse" | "nudge" | "conversation";
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
  /** "Get back on it tomorrow" answers to a nudge: one push at the plan's reminder time. */
  reminders?: { planId: string; dueAt: string; sentAt?: string }[];
  /** Consistency plans that went quiet: the coach owes one "why you started / archive?" message. */
  lapsePlanIds?: string[];
  setupPlanIds?: string[];
  outreachPaused?: boolean;
  lastOutreachAt?: string;
  lastExtraAt?: string;
  viewingUntil?: string;
  lease?: { id: string; until: string };
}

/** Stored on a silent nudge message; the app shows two buttons until one is used. */
export interface CoachNudge {
  planId: string;
  outcome?: "remind" | "archive";
  remindAt?: string;
}
