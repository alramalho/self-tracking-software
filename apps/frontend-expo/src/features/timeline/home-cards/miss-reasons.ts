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

/** Plans whose missed week was answered: finishing Talk to coach records it on the server, for every device. */
export const answeredOnServer = (state: FollowThroughState | undefined, planId: string) =>
  state?.missedWeeks?.[planId]?.week === missedWeek();
