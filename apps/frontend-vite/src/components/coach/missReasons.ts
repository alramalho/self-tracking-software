import { format, startOfWeek, subWeeks } from "date-fns";
import type { MissReason } from "./types";

/** One-tap answers to "What got in the way?". Each opens Talk to coach (same as the app). */
export const MISS_REASONS: MissReason[] = [
  { id: "busy", label: "Busy" },
  { id: "sick", label: "Tired or sick" },
  { id: "travel", label: "Travelling" },
  { id: "motivation", label: "Lost motivation" },
];

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
