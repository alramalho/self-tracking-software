import type {
  HealthWorkoutPreview,
  WorkoutMismatch,
  WorkoutReconciliationPreviewItem,
  WorkoutTrend,
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

const TREND_WEEKS = 8;
const TREND_CARDS = 3;
const PACE_RUNS = 3;
/** Shorter than this, a pace says more about GPS than about the run. */
const PACE_MIN_METERS = 500;

const mondayOf = (date: Date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
};
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const paceOf = (items: WorkoutReconciliationPreviewItem[]) =>
  items.reduce((sum, item) => sum + item.healthWorkout.durationSeconds, 0) /
  (items.reduce((sum, item) => sum + (item.healthWorkout.distanceMeters ?? 0), 0) / 1000);

/**
 * Linked workouts grouped by activity, each with weekly totals for the last eight weeks: the
 * activities you did at least twice in that time, most recent first, at most three.
 */
export function workoutTrends(
  items: WorkoutReconciliationPreviewItem[],
  now = new Date(),
): WorkoutTrend[] {
  const thisWeek = mondayOf(now);
  const firstWeek = new Date(thisWeek);
  firstWeek.setDate(firstWeek.getDate() - (TREND_WEEKS - 1) * 7);
  const groups = new Map<string, WorkoutReconciliationPreviewItem[]>();
  for (const item of items) {
    const title = item.resolved?.linkedActivity?.title ?? item.healthWorkout.displayName;
    const key = title.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const trends: (WorkoutTrend & { latest: number })[] = [];
  for (const [key, all] of groups) {
    const sorted = [...all].sort(
      (a, b) => Date.parse(b.healthWorkout.startAt) - Date.parse(a.healthWorkout.startAt),
    );
    const inWindow = sorted.filter((item) => {
      const start = new Date(item.healthWorkout.startAt);
      return start >= firstWeek && start <= now;
    });
    if (inWindow.length < 2) continue;
    const measured = inWindow.filter((item) => (item.healthWorkout.distanceMeters ?? 0) > 0);
    const unit = measured.length * 2 >= inWindow.length ? "km" : "min";
    const weeks = Array.from({ length: TREND_WEEKS }, (_, index) => {
      const start = new Date(firstWeek);
      start.setDate(start.getDate() + index * 7);
      return { start: dayKey(start), value: 0 };
    });
    for (const item of inWindow) {
      const week = weeks.find((w) => w.start === dayKey(mondayOf(new Date(item.healthWorkout.startAt))));
      if (!week) continue;
      week.value +=
        unit === "km"
          ? (item.healthWorkout.distanceMeters ?? 0) / 1000
          : item.healthWorkout.durationSeconds / 60;
    }
    const paced = sorted.filter((item) => (item.healthWorkout.distanceMeters ?? 0) >= PACE_MIN_METERS);
    const recent = paced.slice(0, PACE_RUNS);
    const earlier = paced.slice(PACE_RUNS, PACE_RUNS * 2);
    const linked = sorted.find((item) => item.resolved?.linkedActivity)?.resolved?.linkedActivity;
    const title = linked?.title ?? sorted[0].healthWorkout.displayName;
    trends.push({
      key,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      emoji: linked?.emoji ?? "",
      unit,
      weeks,
      count: inWindow.length,
      pace:
        unit === "km" && recent.length
          ? { recent: paceOf(recent), earlier: earlier.length === PACE_RUNS ? paceOf(earlier) : null }
          : null,
      latest: Date.parse(sorted[0].healthWorkout.startAt),
    });
  }
  return trends
    .sort((a, b) => b.latest - a.latest)
    .slice(0, TREND_CARDS)
    .map(({ latest: _latest, ...trend }) => trend);
}

/** 5:42 for 342 seconds per kilometre. */
export function formatPace(secondsPerKm: number) {
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

/** "12 s faster than your 3 runs before" or null when the change is too small to mean anything. */
export function paceChange(pace: NonNullable<WorkoutTrend["pace"]>) {
  if (pace.earlier == null) return null;
  const diff = Math.round(pace.earlier - pace.recent);
  if (Math.abs(diff) < 5) return "Same pace as before";
  const amount = Math.abs(diff) >= 60 ? formatPace(Math.abs(diff)) : `${Math.abs(diff)} s`;
  return `${amount} ${diff > 0 ? "faster" : "slower"} than before`;
}
