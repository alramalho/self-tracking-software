export const APPLE_HEALTH_PROVIDER = "apple_health";
export const HEALTHKIT_MERGED_SOURCE = "__healthkit_merged__";

export const APPLE_HEALTH_DAILY_METRICS = [
  "step_count",
  "active_energy_burned",
  "apple_exercise_time",
  "walking_running_distance",
  "flights_climbed",
  "resting_heart_rate",
  "heart_rate_variability_sdnn",
  "respiratory_rate",
  "oxygen_saturation",
  "body_mass",
  "sleep_asleep",
  "sleep_in_bed",
  "sleep_awake",
  "sleep_core",
  "sleep_deep",
  "sleep_rem",
] as const;

export const APPLE_HEALTH_AGGREGATIONS = [
  "sum",
  "average",
  "minimum",
  "maximum",
  "most_recent",
  "duration",
  "count",
] as const;

export interface AppleHealthDailyMetricInput {
  localDate: string;
  metric: (typeof APPLE_HEALTH_DAILY_METRICS)[number];
  aggregation: (typeof APPLE_HEALTH_AGGREGATIONS)[number];
  value: number;
  unit: string;
  sourceBundleId?: string;
  sourceName?: string;
  timezone?: string;
  sampleCount?: number;
}

export type AppleHealthHeartRateZoneSource = "age_estimate" | "default";

export interface AppleHealthHeartRateZones {
  estimatedMaxHeartRateBpm: number;
  source: AppleHealthHeartRateZoneSource;
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}

export interface AppleHealthElevationProfilePoint {
  distanceMeters: number;
  elevationMeters: number;
}

export interface AppleHealthHeartRateSeriesPoint {
  elapsedSeconds: number;
  bpm: number;
}

export interface AppleHealthRoutePoint {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  elevationMeters?: number;
}

export interface AppleHealthWorkoutInput {
  externalId: string;
  activityTypeCode: number;
  activityTypeName: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  activeEnergyKcal?: number;
  distanceMeters?: number;
  elevationAscendedMeters?: number;
  elevationDescendedMeters?: number;
  workoutEffortScore?: number;
  estimatedWorkoutEffortScore?: number;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  heartRateZones?: AppleHealthHeartRateZones;
  heartRateSeries?: AppleHealthHeartRateSeriesPoint[];
  elevationProfile?: AppleHealthElevationProfilePoint[];
  route?: AppleHealthRoutePoint[];
  sourceBundleId: string;
  sourceName?: string;
  sourceProductType?: string;
  deviceName?: string;
  deviceModel?: string;
  timezone?: string;
}

export interface AppleHealthWorkoutMetadata {
  elevationAscendedMeters?: number;
  elevationDescendedMeters?: number;
  workoutEffortScore?: number;
  estimatedWorkoutEffortScore?: number;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  heartRateZones?: AppleHealthHeartRateZones;
  heartRateSeries?: AppleHealthHeartRateSeriesPoint[];
  elevationProfile?: AppleHealthElevationProfilePoint[];
  route?: AppleHealthRoutePoint[];
}

export interface AppleHealthSleepSampleInput {
  externalId: string;
  stageCode: number;
  stage: string;
  startAt: string;
  endAt: string;
  sourceBundleId: string;
  sourceName?: string;
  sourceProductType?: string;
  deviceName?: string;
  deviceModel?: string;
  timezone?: string;
}

export interface AppleHealthSyncBatch {
  deviceId: string;
  requestedDataTypes: string[];
  initialSyncStartAt?: string;
  syncStartedAt: string;
  isFirstBatch: boolean;
  isFinalBatch: boolean;
  dailyMetrics: AppleHealthDailyMetricInput[];
  workouts: AppleHealthWorkoutInput[];
  sleepSamples: AppleHealthSleepSampleInput[];
  deletedWorkoutIds: string[];
  deletedSleepSampleIds: string[];
}

export interface AppleHealthSyncCounts {
  dailyMetrics: number;
  workouts: number;
  sleepSamples: number;
  deletedWorkouts: number;
  deletedSleepSamples: number;
}

export interface AppleHealthStatus {
  connected: boolean;
  requestedDataTypes: string[];
  initialSyncStartAt: Date | null;
  lastSyncStartedAt: Date | null;
  lastSyncCompletedAt: Date | null;
  lastSyncErrorAt: Date | null;
  lastSyncError: string | null;
  importStats: AppleHealthImportStats;
}

export interface AppleHealthImportStats {
  workoutCount: number;
  sleepDayCount: number;
  sleepSampleCount: number;
  dailyMetricCount: number;
  signalTypeCount: number;
  dataStartDate: string | null;
  dataEndDate: string | null;
}
