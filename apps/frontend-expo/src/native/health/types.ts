export interface AppleHealthDailyMetric {
  localDate: string;
  metric:
    | "step_count"
    | "active_energy_burned"
    | "apple_exercise_time"
    | "walking_running_distance"
    | "flights_climbed"
    | "resting_heart_rate"
    | "heart_rate_variability_sdnn"
    | "respiratory_rate"
    | "oxygen_saturation"
    | "body_mass"
    | "sleep_asleep"
    | "sleep_in_bed"
    | "sleep_awake"
    | "sleep_core"
    | "sleep_deep"
    | "sleep_rem";
  aggregation:
    | "sum"
    | "average"
    | "minimum"
    | "maximum"
    | "most_recent"
    | "duration"
    | "count";
  value: number;
  unit: string;
  sourceBundleId?: string;
  sourceName?: string;
  timezone?: string;
  sampleCount?: number;
}

export interface AppleHealthWorkout {
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

export interface AppleHealthElevationProfilePoint {
  distanceMeters: number;
  elevationMeters: number;
}

export interface AppleHealthRoutePoint {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  elevationMeters?: number;
}

export interface AppleHealthHeartRateZones {
  estimatedMaxHeartRateBpm: number;
  source: "age_estimate" | "default";
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}

export interface AppleHealthHeartRateSeriesPoint {
  elapsedSeconds: number;
  bpm: number;
}

export interface AppleHealthSleepSample {
  externalId: string;
  stageCode: number;
  stage:
    | "in_bed"
    | "awake"
    | "asleep_unspecified"
    | "asleep_core"
    | "asleep_deep"
    | "asleep_rem";
  startAt: string;
  endAt: string;
  sourceBundleId: string;
  sourceName?: string;
  sourceProductType?: string;
  deviceName?: string;
  deviceModel?: string;
  timezone?: string;
}

export interface PreparedAppleHealthSync {
  syncToken: string;
  deviceId: string;
  requestedDataTypes: string[];
  initialSyncStartAt: string;
  syncStartedAt: string;
  dailyMetrics: AppleHealthDailyMetric[];
  workouts: AppleHealthWorkout[];
  sleepSamples: AppleHealthSleepSample[];
  deletedWorkoutIds: string[];
  deletedSleepSampleIds: string[];
}

export interface AppleHealthPlugin {
  setAccount(account: string | null): Promise<void>;
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ requestCompleted: boolean }>;
  setWorkoutDetectionEnabled(enabled: boolean): Promise<void>;
  prepareSync(options: {
    initialLookbackDays: number;
    refreshLookbackDays: number;
    estimatedMaxHeartRateBpm?: number;
  }): Promise<PreparedAppleHealthSync>;
  commitSync(options: { syncToken: string }): Promise<void>;
  resetSync(): Promise<void>;
}

export interface AppleHealthStatus {
  connected: boolean;
  requestedDataTypes: string[];
  initialSyncStartAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncErrorAt: string | null;
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

export interface AppleHealthSyncBatch {
  deviceId: string;
  requestedDataTypes: string[];
  initialSyncStartAt: string;
  syncStartedAt: string;
  isFirstBatch: boolean;
  isFinalBatch: boolean;
  dailyMetrics: AppleHealthDailyMetric[];
  workouts: AppleHealthWorkout[];
  sleepSamples: AppleHealthSleepSample[];
  deletedWorkoutIds: string[];
  deletedSleepSampleIds: string[];
}

export interface AppleHealthSyncTotals {
  dailyMetrics: number;
  workouts: number;
  sleepSamples: number;
  deletedWorkouts: number;
  deletedSleepSamples: number;
}
