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
}

/** Everything the coach knows when it writes a turn. */
export interface TalkContext {
  coach: { name: string; persona: string };
  plan: { goal: string; emoji: string | null; timesPerWeek: number | null; activities: string[] };
  today: string;
  weekday: string;
  lastLog: string | null;
}
