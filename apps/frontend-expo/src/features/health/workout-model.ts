import type {
  HealthWorkoutPreview,
  WorkoutMismatch,
  WorkoutReconciliationPreviewItem,
} from "./workout-types";

// A workout that ended this recently is still in front of you, so a photo is
// easy to take. Older ones skip the question.
const PHOTO_PROMPT_WINDOW_MS = 3 * 60 * 60 * 1000;

const MATCH_CHOICE_BLOCKERS = new Set<WorkoutMismatch["code"]>([
  "ambiguous_match",
  "possible_duplicate",
  "unit_incompatible",
]);

const DIFFICULTY_LABELS = {
  very_easy: "Very easy",
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  very_hard: "Very hard",
} as const;

export function workoutEffortSummary(
  workout: HealthWorkoutPreview,
): string | null {
  const effort = workoutEffortLabel(workout);
  const heartRate = workoutHeartRateSummary(workout);
  return [effort, heartRate].filter(Boolean).join(" · ") || null;
}

export function workoutEffortLabel(
  workout: HealthWorkoutPreview,
): string | null {
  const difficulty = workout.difficulty
    ? DIFFICULTY_LABELS[workout.difficulty]
    : null;
  if (!difficulty) return null;
  return `${workout.effortSource === "user" ? "Your effort" : "Watch estimate"} · ${difficulty}`;
}

export function workoutHeartRateSummary(
  workout: HealthWorkoutPreview,
): string | null {
  return workout.averageHeartRateBpm
    ? `${workout.sourceName ?? (workout.provider === "garmin_connect" ? "Garmin Connect" : "Apple Health")} · ${Math.round(workout.averageHeartRateBpm)} bpm average`
    : null;
}

export function workoutQuantity(
  workout: HealthWorkoutPreview,
  measure: string,
): number | null {
  const unit = measure.toLowerCase().trim();
  if (["minutes", "minute", "min", "mins"].includes(unit))
    return Math.max(1, Math.round(workout.durationSeconds / 60));
  if (["hours", "hour", "hr", "hrs"].includes(unit))
    return Math.max(1, Math.round(workout.durationSeconds / 3600));
  if (["seconds", "second", "sec", "secs"].includes(unit))
    return Math.max(1, Math.round(workout.durationSeconds));
  if (
    ["km", "kilometers", "kilometres", "kilometer", "kilometre"].includes(unit)
  )
    return workout.distanceMeters == null
      ? null
      : Math.max(1, Math.round(workout.distanceMeters / 1000));
  if (["miles", "mile", "mi"].includes(unit))
    return workout.distanceMeters == null
      ? null
      : Math.max(1, Math.round(workout.distanceMeters / 1609.344));
  if (["meters", "metres", "meter", "metre", "m"].includes(unit))
    return workout.distanceMeters == null
      ? null
      : Math.max(1, Math.round(workout.distanceMeters));
  if (
    ["sessions", "session", "times", "time", "workout", "workouts"].includes(
      unit,
    )
  )
    return 1;
  return null;
}

export function workoutNeedsMatchChoice(
  item: WorkoutReconciliationPreviewItem,
): boolean {
  return item.mismatches.some((mismatch) =>
    MATCH_CHOICE_BLOCKERS.has(mismatch.code),
  );
}

export function defaultWorkoutSelection(
  item: WorkoutReconciliationPreviewItem,
): string {
  if (workoutNeedsMatchChoice(item)) return "";

  const bestCandidate = item.candidates[0];
  if (bestCandidate) return `entry:${bestCandidate.activityEntryId}`;

  return item.suggestedActivity
    ? `activity:${item.suggestedActivity.id}`
    : "create";
}

export function workoutJustEnded(
  workout: HealthWorkoutPreview,
  now = new Date(),
): boolean {
  const age = now.getTime() - new Date(workout.endAt).getTime();
  return age <= PHOTO_PROMPT_WINDOW_MS;
}

export function workoutEndedLabel(
  workout: HealthWorkoutPreview,
  now = new Date(),
): string {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(workout.endAt).getTime()) / 60000),
  );
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "an hour ago" : `${hours} hours ago`;
}
