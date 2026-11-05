import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, startOfWeek, subWeeks } from "date-fns";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import type { MissReason } from "./types";

/** One-tap answers to "What got in the way?". Each opens Talk to coach, where the coach takes it from there. */
export const MISS_REASONS: MissReason[] = [
  { id: "busy", label: "Busy", emoji: "🗓️" },
  { id: "sick", label: "Tired or sick", emoji: "🤒" },
  { id: "travel", label: "Travelling", emoji: "✈️" },
  { id: "motivation", label: "Lost motivation", emoji: "🪫" },
];

/** The missed week, keyed by its first day. */
export const missedWeek = (now = new Date()) => format(startOfWeek(subWeeks(now, 1)), "yyyy-MM-dd");

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
