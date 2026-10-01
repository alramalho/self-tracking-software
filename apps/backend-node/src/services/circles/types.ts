import type { CircleRole, CircleStatus } from "@tsw/prisma";

// "Match me by" choices from onboarding or the plan's circle row.
export interface MatchPreferences {
  wantsPace: boolean;
  wantsNearby: boolean;
  wantsAge: boolean;
}

export interface ApproxLocation {
  latitude: number;
  longitude: number;
  place?: string;
}

// Everything the matcher needs to know about one person on one plan.
export interface MatchProfile {
  userId: string;
  planId: string;
  timezone: string | null;
  age: number | null;
  latitude: number | null;
  longitude: number | null;
  // Planned sessions per week, and the share of them actually done over the last four weeks.
  weeklyTarget: number;
  completionRate: number | null;
  preferences: MatchPreferences;
}

export type Lever = "goal" | "pace" | "place" | "age";

// "Why" chips on a match: only levers that hold for everyone in the circle.
export type Reason = "goal" | "pace" | "sameCity" | "timezone" | "age";

// One side's view of a pair: the weighted score plus each lever's raw value (0..1).
export interface PairScore {
  score: number;
  levers: Partial<Record<Lever, number>>;
}

export interface CircleMatch {
  circleId: string;
  score: number;
  reasons: Reason[];
}

export interface CirclePerson {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
}

export interface CirclePlan {
  id: string;
  goal: string;
  emoji: string | null;
}

export interface CircleCard {
  id: string;
  name: string;
  emoji: string;
  status: CircleStatus;
  place: string | null;
  memberCount: number;
  // "3–4 a week", from the members' weekly targets.
  paceLabel: string | null;
  logsThisWeek: number;
  // Blurred previews of the latest photos, never the photos themselves.
  previews: string[];
  morePhotos: number;
  reasons: Reason[];
  members: { name: string | null; goal: string; picture: string | null }[];
}

export interface MemberWeek {
  target: number;
  done: number;
  daysLeft: number;
  toGo: number;
  // At their usual pace they won't reach the target this week.
  behind: boolean;
  // Joined after this week started: never counted as behind.
  isNew: boolean;
}

export interface BoardMember {
  user: CirclePerson;
  plan: CirclePlan;
  role: CircleRole;
  joinedAt: Date;
  week: MemberWeek;
  // First log on the circle plan after joining.
  hasIntro: boolean;
  // Joined but hasn't posted the first photo log yet; only they can see themselves.
  pending: boolean;
  nudgedToday: boolean;
}

export interface CircleRecap {
  weekStart: string;
  hit: number;
  total: number;
  topName: string | null;
  topCount: number;
}

// "3 of 4 this week" on a circle log: the days its owner had done that week, up to that log.
export interface WeekChip {
  done: number;
  target: number;
}

export interface PastWeekPerson {
  userId: string;
  done: number;
  target: number;
  hit: boolean;
}

export interface PastWeeks {
  // Finished weeks, oldest first, with whoever was already in the circle that week.
  weeks: { start: string; allHit: boolean; people: PastWeekPerson[] }[];
  // Share of their own target each person did (never above 100%); ties share a rank.
  // `hits` lines up with `weeks`; null for weeks before they joined.
  ranking: { userId: string; percent: number; rank: number; hits: (boolean | null)[] }[];
}

export interface CircleBoard {
  id: string;
  name: string;
  emoji: string;
  status: CircleStatus;
  inviteCode: string;
  openToMatching: boolean;
  discoverable: boolean;
  place: string | null;
  paceLabel: string | null;
  cap: number;
  // The owner's switch for the coach's recap and halfway check in the chat.
  coachPosts: boolean;
  me: { role: CircleRole; planId: string; hasIntro: boolean; pending: boolean; muted: boolean };
  members: BoardMember[];
  togetherStreak: number;
  recap: CircleRecap | null;
  pastWeeks: PastWeeks | null;
}
