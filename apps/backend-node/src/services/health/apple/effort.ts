import type {
  AppleHealthElevationProfilePoint,
  AppleHealthHeartRateZones,
  AppleHealthHeartRateSeriesPoint,
  AppleHealthRoutePoint,
  AppleHealthWorkoutMetadata,
} from "./types";

export const WORKOUT_DIFFICULTIES = [
  "very_easy",
  "easy",
  "moderate",
  "hard",
  "very_hard",
] as const;

export type WorkoutDifficulty = (typeof WORKOUT_DIFFICULTIES)[number];
export type WorkoutEffortSource = "user" | "apple_estimated";

export interface WorkoutEffortInsight {
  score: number;
  source: WorkoutEffortSource;
  difficulty: WorkoutDifficulty;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function heartRateZones(value: unknown): AppleHealthHeartRateZones | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const zones = value as Record<string, unknown>;
  const estimatedMaxHeartRateBpm = finiteNumber(
    zones.estimatedMaxHeartRateBpm,
  );
  const source = zones.source;
  const seconds = [
    finiteNumber(zones.zone1Seconds),
    finiteNumber(zones.zone2Seconds),
    finiteNumber(zones.zone3Seconds),
    finiteNumber(zones.zone4Seconds),
    finiteNumber(zones.zone5Seconds),
  ];
  if (
    estimatedMaxHeartRateBpm == null ||
    (source !== "age_estimate" && source !== "default") ||
    seconds.some((value) => value == null || value < 0)
  ) {
    return undefined;
  }

  return {
    estimatedMaxHeartRateBpm,
    source,
    zone1Seconds: seconds[0]!,
    zone2Seconds: seconds[1]!,
    zone3Seconds: seconds[2]!,
    zone4Seconds: seconds[3]!,
    zone5Seconds: seconds[4]!,
  };
}

function elevationProfile(
  value: unknown,
): AppleHealthElevationProfilePoint[] | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 240) {
    return undefined;
  }
  const points = value
    .map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        return null;
      }
      const candidate = point as Record<string, unknown>;
      const distanceMeters = finiteNumber(candidate.distanceMeters);
      const elevationMeters = finiteNumber(candidate.elevationMeters);
      return distanceMeters == null || distanceMeters < 0 || elevationMeters == null
        ? null
        : { distanceMeters, elevationMeters };
    })
    .filter((point): point is AppleHealthElevationProfilePoint => point !== null);
  return points.length >= 2 ? points : undefined;
}

function heartRateSeries(
  value: unknown,
): AppleHealthHeartRateSeriesPoint[] | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 240) {
    return undefined;
  }
  const points = value
    .map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        return null;
      }
      const candidate = point as Record<string, unknown>;
      const elapsedSeconds = finiteNumber(candidate.elapsedSeconds);
      const bpm = finiteNumber(candidate.bpm);
      return elapsedSeconds == null || elapsedSeconds < 0 || bpm == null || bpm <= 0
        ? null
        : { elapsedSeconds, bpm };
    })
    .filter((point): point is AppleHealthHeartRateSeriesPoint => point !== null);
  return points.length >= 2 ? points : undefined;
}

function route(value: unknown): AppleHealthRoutePoint[] | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 240) {
    return undefined;
  }
  const points = value
    .map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        return null;
      }
      const candidate = point as Record<string, unknown>;
      const latitude = finiteNumber(candidate.latitude);
      const longitude = finiteNumber(candidate.longitude);
      const distanceMeters = finiteNumber(candidate.distanceMeters);
      const elevationMeters = candidate.elevationMeters == null
        ? undefined
        : finiteNumber(candidate.elevationMeters) ?? undefined;
      return latitude == null || latitude < -90 || latitude > 90 ||
        longitude == null || longitude < -180 || longitude > 180 ||
        distanceMeters == null || distanceMeters < 0
        ? null
        : { latitude, longitude, distanceMeters, ...(elevationMeters == null ? {} : { elevationMeters }) };
    })
    .filter((point): point is AppleHealthRoutePoint => point !== null);
  return points.length >= 2 ? points : undefined;
}

export function workoutMetadata(value: unknown): AppleHealthWorkoutMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  const workoutEffortScore = finiteNumber(metadata.workoutEffortScore);
  const estimatedWorkoutEffortScore = finiteNumber(
    metadata.estimatedWorkoutEffortScore,
  );
  const averageHeartRateBpm = finiteNumber(metadata.averageHeartRateBpm);
  const maximumHeartRateBpm = finiteNumber(metadata.maximumHeartRateBpm);
  const elevationAscendedMeters = finiteNumber(metadata.elevationAscendedMeters);
  const elevationDescendedMeters = finiteNumber(metadata.elevationDescendedMeters);
  const parsedHeartRateZones = heartRateZones(metadata.heartRateZones);
  const parsedHeartRateSeries = heartRateSeries(metadata.heartRateSeries);
  const parsedElevationProfile = elevationProfile(metadata.elevationProfile);
  const parsedRoute = route(metadata.route);
  return {
    ...(elevationAscendedMeters == null ? {} : { elevationAscendedMeters }),
    ...(elevationDescendedMeters == null ? {} : { elevationDescendedMeters }),
    ...(workoutEffortScore == null ? {} : { workoutEffortScore }),
    ...(estimatedWorkoutEffortScore == null
      ? {}
      : { estimatedWorkoutEffortScore }),
    ...(averageHeartRateBpm == null ? {} : { averageHeartRateBpm }),
    ...(maximumHeartRateBpm == null ? {} : { maximumHeartRateBpm }),
    ...(parsedHeartRateZones == null
      ? {}
      : { heartRateZones: parsedHeartRateZones }),
    ...(parsedHeartRateSeries == null
      ? {}
      : { heartRateSeries: parsedHeartRateSeries }),
    ...(parsedElevationProfile == null
      ? {}
      : { elevationProfile: parsedElevationProfile }),
    ...(parsedRoute == null ? {} : { route: parsedRoute }),
  };
}

export function difficultyFromAppleEffort(score: number): WorkoutDifficulty {
  if (score <= 2) return "very_easy";
  if (score <= 4) return "easy";
  if (score <= 6) return "moderate";
  if (score <= 8) return "hard";
  return "very_hard";
}

export function workoutEffortInsight(metadata: unknown): WorkoutEffortInsight | null {
  const values = workoutMetadata(metadata);
  const reported = values.workoutEffortScore;
  const estimated = values.estimatedWorkoutEffortScore;
  const score = reported ?? estimated;
  if (score == null || score < 1 || score > 10) return null;
  return {
    score,
    source: reported == null ? "apple_estimated" : "user",
    difficulty: difficultyFromAppleEffort(score),
  };
}
