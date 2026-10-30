import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDays, differenceInCalendarDays, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import type { MissReason } from "./types";

const fullWeek = (target: number, daysLeft: number) => Math.min(target, daysLeft);
// After a trip or being unwell, the first week back eases in one session lighter.
const easeIn = (target: number, daysLeft: number) => Math.max(1, Math.min(target - 1, daysLeft));

/** One-tap answers to "What got in the way?". Each leads to picking this week's days, not to a chat message. */
export const MISS_REASONS: MissReason[] = [
  { id: "busy", label: "Busy", emoji: "🗓️", suggest: fullWeek },
  { id: "sick", label: "Tired or sick", emoji: "🤒", suggest: easeIn },
  { id: "travel", label: "Travelling", emoji: "✈️", suggest: easeIn },
  { id: "motivation", label: "Lost motivation", emoji: "🪫", suggest: fullWeek },
];

/** "Something else": the chat opens with the sentence started, for the user to finish and send. */
export const missMessageStart = (goal: string) => `I missed "${goal}" last week because `;

/** The missed week, keyed by its first day. */
export const missedWeek = (now = new Date()) => format(startOfWeek(subWeeks(now, 1)), "yyyy-MM-dd");

/** Today through the end of this week: the days still open for making it work. */
export function daysLeftThisWeek(now = new Date()) {
  const count = differenceInCalendarDays(endOfWeek(now), now) + 1;
  return Array.from({ length: count }, (_, i) => format(addDays(now, i), "yyyy-MM-dd"));
}

/** `count` of the open days, spread out so sessions don't stack up. */
export function spreadDays(days: string[], count: number) {
  if (count >= days.length) return days;
  if (count <= 0) return [];
  const step = (days.length - 1) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => days[count === 1 ? 0 : Math.round(i * step)]);
}

/** Plans whose missed week was answered, on the server or (for "Something else") on this device. */
export const answeredOnServer = (state: FollowThroughState | undefined, planId: string) =>
  state?.missedWeeks?.[planId]?.week === missedWeek();

// The coach asks once per missed week: after an answer, the sheet offers the conversation instead.
const key = (planId: string) => `tracking.so.miss-reason.v1:${planId}`;

export async function answeredMissedWeek(planId: string) {
  try {
    return (await AsyncStorage.getItem(key(planId))) === missedWeek();
  } catch {
    return false;
  }
}

export async function rememberMissAnswered(planId: string) {
  await AsyncStorage.setItem(key(planId), missedWeek()).catch(() => {});
}
