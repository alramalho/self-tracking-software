export type FunnelStepId =
  | "signup"
  | "goal"
  | "baseline"
  | "motivation"
  | "rhythm"
  | "support"
  | "end"
  | "finished"
  | "logged"
  | "active";

export type FunnelPerson = {
  id: string;
  username: string | null;
  signedUpAt: string;
  lastActiveAt: string | null;
};

export type FunnelStep = {
  id: FunnelStepId;
  label: string;
  /** People who got at least this far. */
  reached: number;
  /** People whose furthest point is this step and who have been gone a day or more. */
  stoppedHere: FunnelPerson[];
  /** People at this step who were active in the last day: they may still continue. */
  inProgress: number;
};

export type Funnel = {
  days: number;
  steps: FunnelStep[];
  aiConsent: { granted: number; declined: number; neverAsked: number };
  /** Signups in the window on the paid plan now. */
  paying: number;
};

export type DayStats = {
  day: string;
  dau: number;
  wau: number;
  mau: number;
  signups: number;
  logs: number;
  voice: { kept: number; dropped: number };
};

export type VoiceNote = {
  clientRequestId: string;
  at: string;
  username: string | null;
  transcript: string;
  heardAs: string[];
  kept: boolean;
  hasRecording: boolean;
};

export type TopUser = {
  id: string;
  username: string | null;
  activeDays: number;
  logs: number;
  voiceNotes: number;
  plan: string;
  signedUpAt: string;
  lastActiveAt: string | null;
};

export type RoughEdges = {
  days: number;
  kinds: { kind: string; label: string; count: number; people: number }[];
  recent: { at: string; kind: string; label: string; username: string | null; detail: string | null }[];
};

export type CoachCostPart = "chat" | "search" | "checkins" | "talk";

export type CoachCosts = {
  days: number;
  totalUsd: number;
  /** Chat cost (with its web searches) per chat reply. */
  perReplyUsd: number | null;
  perDay: ({ day: string } & Record<CoachCostPart, number>)[];
  parts: { part: CoachCostPart; label: string; usd: number; calls: number }[];
  models: { model: string; usd: number; calls: number }[];
  /** Top 5 by cost; only calls logged since 24 Nov 2026 carry a person. */
  people: { username: string | null; usd: number; calls: number }[];
};

export type AnalyticsOverview = {
  generatedAt: string;
  funnel: Funnel;
  series: DayStats[];
  voiceNotes: VoiceNote[];
  topUsers: TopUser[];
  roughEdges: RoughEdges;
  coachCosts: CoachCosts;
};
