import type { Plan } from "@/core/types";

const nonnegative = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;

/** Achievement flags describe the current stage, not whether earlier stages were reached. */
export function streakProgress(progress: Plan["progress"]) {
  const habit = progress?.habitAchievement;
  const lifestyle = progress?.lifestyleAchievement;
  const habitTarget = Math.max(1, nonnegative(habit?.maxValue, 4));
  const lifestyleTarget = Math.max(habitTarget, nonnegative(lifestyle?.maxValue, 9));
  const authoritative = progress?.achievement?.streak ?? progress?.currentStreak;
  const streak = nonnegative(authoritative, Math.max(
    nonnegative(habit?.progressValue),
    nonnegative(lifestyle?.progressValue),
    lifestyle?.isAchieved ? lifestyleTarget : habit?.isAchieved ? habitTarget : 0,
  ));
  const stage = streak >= habitTarget ? "Lifestyle" : "Habit";
  return { stage, streak, target: stage === "Lifestyle" ? lifestyleTarget : habitTarget };
}

/** Cap the visual footprint, never the streak displayed to the person. */
export function progressCircles(value: number, target: number) {
  const current = nonnegative(value);
  const count = Math.min(9, nonnegative(target));
  return { count, filled: Math.min(count, current), overflow: Math.max(0, current - count) };
}
