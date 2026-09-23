import type { DistanceTimePoint } from "../workout-types";
import type { KilometreSplit, SplitWorkout } from "./types";

const MAX_BOUNDARY_SAMPLE_GAP_SECONDS = 120;

function crossingTime(points: DistanceTimePoint[], meters: number): number | null {
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1];
    const after = points[index];
    if (after.distanceMeters < meters) continue;
    if (before.distanceMeters === meters) return before.elapsedSeconds;
    if (after.distanceMeters === before.distanceMeters) return after.elapsedSeconds;
    if (after.distanceMeters !== meters &&
      after.elapsedSeconds - before.elapsedSeconds > MAX_BOUNDARY_SAMPLE_GAP_SECONDS) return null;
    const fraction = (meters - before.distanceMeters) /
      (after.distanceMeters - before.distanceMeters);
    return before.elapsedSeconds + fraction * (after.elapsedSeconds - before.elapsedSeconds);
  }
  return null;
}

export function kilometreSplits(workout: SplitWorkout): KilometreSplit[] {
  const samples = workout.distanceTimeSeries;
  const total = workout.distanceMeters;
  if (!samples || samples.length < 2 || total == null || !Number.isFinite(total) || total < 100) return [];
  const wallSeconds = (Date.parse(workout.endAt) - Date.parse(workout.startAt)) / 1000;
  if (!Number.isFinite(wallSeconds) || wallSeconds <= 0) return [];

  const ordered = [...samples].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const points: DistanceTimePoint[] = [];
  for (const point of ordered) {
    const previous = points[points.length - 1];
    if (previous?.elapsedSeconds === point.elapsedSeconds) {
      previous.distanceMeters = Math.max(previous.distanceMeters, point.distanceMeters);
    } else {
      points.push({ ...point });
    }
  }
  if (points.length < 2) return [];
  if (points.some((point) => !Number.isFinite(point.elapsedSeconds) ||
    !Number.isFinite(point.distanceMeters) || point.elapsedSeconds < 0 || point.distanceMeters < 0)) return [];
  const first = points[0];
  if (first.elapsedSeconds > 120 || first.distanceMeters > 200) return [];
  if (first.elapsedSeconds !== 0 || first.distanceMeters !== 0) {
    points.unshift({ elapsedSeconds: 0, distanceMeters: 0 });
  }
  for (let index = 1; index < points.length; index++) {
    if (points[index].elapsedSeconds <= points[index - 1].elapsedSeconds ||
      points[index].distanceMeters < points[index - 1].distanceMeters) return [];
  }
  const last = points[points.length - 1];
  if (last.elapsedSeconds > wallSeconds + 5 ||
    Math.abs(last.distanceMeters - total) > Math.max(25, total * 0.01)) return [];

  const result: KilometreSplit[] = [];
  let startMeters = 0;
  let startSeconds = 0;
  for (let number = 1; startMeters < last.distanceMeters - 1; number++) {
    const endMeters = Math.min(number * 1000, last.distanceMeters);
    const endSeconds = crossingTime(points, endMeters);
    if (endSeconds == null || endSeconds <= startSeconds) return [];
    const distanceMeters = endMeters - startMeters;
    const elapsedSeconds = endSeconds - startSeconds;
    result.push({
      number,
      startMeters,
      endMeters,
      distanceMeters,
      elapsedSeconds,
      paceSecondsPerKm: elapsedSeconds * 1000 / distanceMeters,
      partial: distanceMeters < 999.5,
    });
    startMeters = endMeters;
    startSeconds = endSeconds;
  }
  return result;
}

export function splitClock(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function splitBarPercent(split: KilometreSplit, splits: KilometreSplit[]): number {
  const fastest = Math.min(...splits.map((value) => value.paceSecondsPerKm));
  return (fastest / split.paceSecondsPerKm) * 100;
}
