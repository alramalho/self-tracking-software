import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ElevationProfilePoint, HeartRateSeriesPoint, HeartRateZones, RoutePoint } from "../../src/features/health/workout-types";
import type { ComparisonWorkout, TimedDistancePoint } from "./types";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function utcTimestamp(value: unknown): string | null {
  const candidate = string(value);
  if (!candidate) return null;
  // PostgreSQL timestamp JSON from the read-only export is UTC without a suffix.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(candidate))
    return `${candidate.replace(" ", "T")}Z`;
  return candidate;
}

function points<T>(value: unknown, keys: string[]): T[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 240) return null;
  if (value.some((item) => {
    const candidate = record(item);
    return !candidate || keys.some((key) => number(candidate[key]) == null);
  })) return null;
  // Keep the provider's samples and their timestamps exactly as supplied.
  return value as T[];
}

function zones(value: unknown): HeartRateZones | null {
  const candidate = record(value);
  if (!candidate || (candidate.source !== "age_estimate" && candidate.source !== "default")) return null;
  const keys = ["estimatedMaxHeartRateBpm", "zone1Seconds", "zone2Seconds", "zone3Seconds", "zone4Seconds", "zone5Seconds"];
  if (keys.some((key) => number(candidate[key]) == null)) return null;
  return candidate as unknown as HeartRateZones;
}

export function mapComparisonWorkout(value: unknown): ComparisonWorkout {
  const workout = record(value);
  if (!workout) throw new Error("Comparison workout must be an object");
  const metadata = record(workout.metadata) ?? {};
  const activityTypeName = string(workout.activityTypeName);
  const startAt = utcTimestamp(workout.startAt);
  const endAt = utcTimestamp(workout.endAt);
  const durationSeconds = number(workout.durationSeconds);
  if (!activityTypeName || !startAt || !endAt || !durationSeconds ||
    !Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt)) ||
    Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error("Comparison workout is missing required timing or activity fields");
  }

  const userEffort = number(metadata.workoutEffortScore);
  const estimatedEffort = number(metadata.estimatedWorkoutEffortScore);
  const profileAge = number(workout.age);
  return {
    profileAge: profileAge != null && Number.isInteger(profileAge) && profileAge >= 13 && profileAge <= 100
      ? profileAge : null,
    preview: {
      id: "health-run", // Stable local deep link; the source record ID is never exposed.
      provider: "apple_health",
      activityTypeName,
      displayName: activityTypeName.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      startAt,
      endAt,
      durationSeconds,
      distanceMeters: number(workout.distanceMeters),
      activeEnergyKcal: number(workout.activeEnergyKcal),
      elevationAscendedMeters: number(metadata.elevationAscendedMeters),
      elevationDescendedMeters: number(metadata.elevationDescendedMeters),
      effortScore: userEffort ?? estimatedEffort,
      effortSource: userEffort == null ? estimatedEffort == null ? null : "apple_estimated" : "user",
      averageHeartRateBpm: number(metadata.averageHeartRateBpm),
      maximumHeartRateBpm: number(metadata.maximumHeartRateBpm),
      heartRateZones: zones(metadata.heartRateZones),
      heartRateSeries: points<HeartRateSeriesPoint>(metadata.heartRateSeries, ["elapsedSeconds", "bpm"]),
      distanceTimeSeries: points<TimedDistancePoint>(metadata.distanceTimeSeries, ["elapsedSeconds", "distanceMeters"]),
      elevationProfile: points<ElevationProfilePoint>(metadata.elevationProfile, ["distanceMeters", "elevationMeters"]),
      route: points<RoutePoint>(metadata.route, ["latitude", "longitude", "distanceMeters"]),
      sourceName: string(workout.sourceName),
      deviceName: string(workout.deviceName),
      timezone: string(workout.timezone),
    },
  };
}

export function loadComparisonWorkout(file: string): ComparisonWorkout {
  if (!isAbsolute(file)) throw new Error("E2E_WORKOUT_FILE must be an absolute local path");
  const withinCheckout = relative(resolve(process.cwd(), "../.."), realpathSync(file));
  if (!withinCheckout.startsWith("..") && !isAbsolute(withinCheckout))
    throw new Error("E2E_WORKOUT_FILE must remain outside the repository");
  return mapComparisonWorkout(JSON.parse(readFileSync(file, "utf8")));
}
