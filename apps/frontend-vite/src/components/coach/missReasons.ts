import { format, startOfWeek, subWeeks } from "date-fns";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import type { MissReason } from "./types";

/** One-tap answers to "What got in the way?". Each opens Talk to coach (same as the app). */
export const MISS_REASONS: MissReason[] = [
  { id: "busy", label: "Busy" },
  { id: "sick", label: "Tired or sick" },
  { id: "travel", label: "Travelling" },
  { id: "motivation", label: "Lost motivation" },
];

// The coach asks once per missed week: finishing Talk to coach answers it on the server, for every device.
const missedWeek = (now = new Date()) => format(startOfWeek(subWeeks(now, 1)), "yyyy-MM-dd");

export const answeredOnServer = (state: FollowThroughState | undefined, planId: string) =>
  state?.missedWeeks?.[planId]?.week === missedWeek();
