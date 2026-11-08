/** Stored alongside a plan's existing follow-through agreement. Absent means legacy behavior. */
export interface PlanCoaching {
  role: "tracking" | "consistency" | "training";
  followUps: boolean;
  dataAccess: { workouts: boolean; sleep: boolean };
}
/** A plan change the coach prepared but holds back until the person is in the conversation. */
export interface HeldPlanProposal {
  planId: string;
  planGoal: string;
  planEmoji: string | null;
  description: string;
  patch: unknown;
}
/** What a proactive opener is about. Shared progressively once the person replies; never posted as-is. */
export interface CoachAgenda {
  briefing: string;
  proposals: HeldPlanProposal[];
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
  agenda?: CoachAgenda;
}
export interface CoachMonitoringState {
  requests: CoachRequest[];
  reviewed: Record<string, string>;
  consideredEntries: Record<string, string>;
  pausedPlanIds: string[];
  /**
   * Talking to the coach can quiet a plan: no alert and no nudge until `until` (yyyy-MM-dd, inclusive).
   * "away" when the person said when they're back, "not_sure" when the coach should ask again then,
   * "committed" when they named the day of their next session, "answered" for the rest of the day they
   * talked it through.
   * The streak and the weeks still count; quiet only silences the coach.
   */
  quiet?: Record<string, PlanQuiet>;
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
  /** Paid generations per decision id, counted at claim, so a dropped or failed result is never paid for over and over. */
  attempts?: Record<string, { count: number; at: string }>;
}

export interface PlanQuiet {
  until: string;
  why: "away" | "not_sure" | "committed" | "answered";
  at: string;
}

/** Stored on a silent nudge message; the app shows two buttons until one is used. */
export interface CoachNudge {
  planId: string;
  outcome?: "remind" | "archive";
  remindAt?: string;
}
