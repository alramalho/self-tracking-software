/** Why the plan slipped, from the drawer; "other" and "talk" start with the person's own words. */
export type TalkReason = "busy" | "sick" | "travel" | "motivation" | "other" | "talk";

/** One coach screen, as the server sends it. */
export interface TalkTurn {
  say: string;
  detail: string;
  /** "text": a text field with the mic and "Not sure yet". "none": the end, Continue. */
  ask: "text" | "none";
  placeholder: string;
  /** Set when this screen quieted the plan until that day: "Keep nudging me" undoes it. */
  quietUntil: string | null;
  /** Set when they named the day of their next session; checkAt is null when it's too late today. */
  commitment?: { day: string; checkAt: string | null } | null;
}

/** A screen already answered, sent back so the coach knows the conversation so far. */
export interface TalkAnswered {
  say: string;
  answer: string;
}

/** Every screen answered so far, the latest last; empty when a picked reason opens the conversation. */
export interface TalkRequest {
  reason: TalkReason;
  turns: TalkAnswered[];
  notSure: boolean;
  /** The alert was "missed last week": the end of the conversation answers that week. */
  missed: boolean;
}

export interface TalkToCoachSearch {
  planId: string;
  reason: TalkReason;
  missed: boolean;
}
