import { format, startOfWeek, subWeeks } from "date-fns";
import type { MissReason } from "./types";

/** One-tap answers to "What got in the way?", told to the coach in the person's own words (same as the app). */
export const MISS_REASONS: MissReason[] = [
  { label: "Busy", says: "I was too busy." },
  { label: "Tired or sick", says: "I was tired or not feeling well." },
  { label: "Travelling", says: "I was travelling." },
  { label: "Lost motivation", says: "I lost motivation." },
];

export const missMessage = (goal: string, says: string) =>
  `I missed "${goal}" last week. ${says} Can you help me make this week work?`;

/** "Something else": the message starts the sentence for the person to finish. */
export const missMessageStart = (goal: string) => `I missed "${goal}" last week because `;

// The coach asks once per missed week: the answer is remembered on this device.
const key = (planId: string) => `tracking.so.miss-reason.v1:${planId}`;
const missedWeek = (now = new Date()) => format(startOfWeek(subWeeks(now, 1)), "yyyy-MM-dd");

export function answeredMissedWeek(planId: string) {
  try {
    return localStorage.getItem(key(planId)) === missedWeek();
  } catch {
    return false;
  }
}

export function rememberMissAnswered(planId: string) {
  try {
    localStorage.setItem(key(planId), missedWeek());
  } catch {
    // Private windows can refuse storage; the question will just come back.
  }
}
