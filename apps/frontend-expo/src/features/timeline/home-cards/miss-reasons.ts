import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, startOfWeek, subWeeks } from "date-fns";
import type { MissReason } from "./types";

/** One-tap answers to "What got in the way?", each told to the coach in the user's own words. */
export const MISS_REASONS: MissReason[] = [
  { label: "Busy", says: "I was too busy." },
  { label: "Tired or sick", says: "I was tired or not feeling well." },
  { label: "Travelling", says: "I was travelling." },
  { label: "Lost motivation", says: "I lost motivation." },
];

/** What the user sends: the miss, why, and a request for one concrete fix for this week. */
export const missMessage = (goal: string, says: string) =>
  `I missed "${goal}" last week. ${says} Can you help me make this week work?`;

/** "Something else": the chat opens with the sentence started, for the user to finish. */
export const missMessageStart = (goal: string) => `I missed "${goal}" last week because `;

// The coach asks once per missed week: after an answer, the sheet offers the conversation instead.
const key = (planId: string) => `tracking.so.miss-reason.v1:${planId}`;
const missedWeek = (now = new Date()) => format(startOfWeek(subWeeks(now, 1)), "yyyy-MM-dd");

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
