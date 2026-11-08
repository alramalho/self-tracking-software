import type { z } from "zod/v4";
import type { talkRequestSchema, turnSchema } from "./schema";

/** What the app sends: why the plan slipped, the screens so far, and the person's latest answer. */
export type TalkRequest = z.infer<typeof talkRequestSchema>;
/** One coach screen, as the model writes it. */
export type CoachTurn = z.infer<typeof turnSchema>;

/** What the app shows: the coach's screen, and what changed because of it. */
export interface TalkTurn {
  say: string;
  detail: string;
  /** "text": a text field with the mic, and "Not sure yet". "none": the conversation is over, Continue. */
  ask: "text" | "none";
  placeholder: string;
  /** Set when this turn quieted the plan: the app offers "Keep nudging me" to undo it. */
  quietUntil: string | null;
  /** Set when they named the day of their next session: the coach checks on it then (null when too late today). */
  commitment: { day: string; checkAt: string | null } | null;
}

/** Everything the coach knows when it writes a turn. */
export interface TalkContext {
  coach: { name: string; persona: string };
  /** The times the coach may pick for checking on a commitment. */
  checkIn: CheckInTimes;
  /** The plan's morning reminder time, HH:mm: when the coach checks in after a trip. */
  morningCheckIn: string;
  plan: { goal: string; emoji: string | null; timesPerWeek: number | null; activities: string[] };
  today: string;
  weekday: string;
  lastLog: string | null;
}

/** Where the plan's coach settings live, to time the check-in on a commitment. */
export interface CheckInClock {
  timezone: string;
  /** The plan's day reminder, HH:mm. */
  morning: string;
}

/** HH:mm in the person's timezone. */
export interface CheckInTimes {
  /** Today's earliest check-in, null when it's too late today. */
  earliestToday: string | null;
  latest: string;
  /** When no time was named. */
  usual: string;
}
