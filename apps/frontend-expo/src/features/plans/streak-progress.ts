import { streakProgress as sharedStreakProgress } from "@tsw/prisma/home-todo";
import type { Plan } from "@/core/types";

const nonnegative = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;

/** The streak and its next badge, by the rule both apps share. */
export function streakProgress(progress: Plan["progress"]) {
  const { stage, value, target } = sharedStreakProgress(progress);
  return { stage, streak: value, target };
}

/** Cap the visual footprint, never the streak displayed to the person. */
export function progressCircles(value: number, target: number) {
  const current = nonnegative(value);
  const count = Math.min(9, nonnegative(target));
  return { count, filled: Math.min(count, current), overflow: Math.max(0, current - count) };
}
