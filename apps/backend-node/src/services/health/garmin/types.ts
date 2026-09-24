export interface GarminOAuthConfig {
  /** Which flow new connections use. Existing connections keep the version they were made with. */
  oauthVersion: 1 | 2;
  /** OAuth1 consumer key, or the OAuth2 client ID (Garmin uses the same value). */
  consumerKey: string;
  consumerSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  frontendUrl: string;
  apiBaseUrl: string;
}

export interface GarminRequestToken {
  token: string;
  secret: string;
}

/** OAuth1 signs each request with token + secret; OAuth2 sends a bearer token. */
export type GarminAccessToken =
  | { version: 1; token: string; secret: string }
  | { version: 2; token: string };

export interface GarminOAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GarminStatus {
  available: boolean;
  connected: boolean;
  permissions: string[];
  connectedAt: string | null;
  initialSyncStartedAt: string | null;
  backfillRequestedAt: string | null;
  backfillInProgress: boolean;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncError: string | null;
  importStats: GarminImportStats;
}

export interface GarminConnectStart {
  authorizationUrl: string;
}

export interface GarminImportStats {
  workoutCount: number;
  sleepDayCount: number;
  sleepSampleCount: number;
  dailyMetricCount: number;
  signalTypeCount: number;
  dataStartDate: string | null;
  dataEndDate: string | null;
}

export interface GarminSyncCounts {
  dailyMetrics: number;
  workouts: number;
  sleepSamples: number;
  summaryTypes: number;
  backfillRequested: boolean;
  backfillStatus:
    | "not_requested"
    | "accepted"
    | "already_requested"
    | "rate_limited"
    | "unavailable"
    | "missing_permission";
}

export interface GarminSyncResult {
  counts: GarminSyncCounts;
  lastSyncCompletedAt: string | null;
}

export interface GarminDailyMetricInput {
  localDate: string;
  metric: string;
  aggregation: string;
  value: number;
  unit: string;
  sourceBundleId: string;
  sourceName?: string;
  timezone?: string;
  sampleCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GarminWorkoutInput {
  externalId: string;
  activityTypeCode: number;
  activityTypeName: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  activeEnergyKcal?: number;
  distanceMeters?: number;
  sourceBundleId: string;
  sourceName?: string;
  sourceProductType?: string;
  deviceName?: string;
  deviceModel?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface GarminSleepSampleInput {
  externalId: string;
  stageCode: number;
  stage:
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
  metadata?: Record<string, unknown>;
}

export interface GarminNormalizedData {
  dailyMetrics: GarminDailyMetricInput[];
  workouts: GarminWorkoutInput[];
  sleepSamples: GarminSleepSampleInput[];
  summaryTypes: string[];
  uploadEndTimeSeconds?: number;
}

export type GarminJsonObject = Record<string, unknown>;

export interface GarminActivityDetail {
  activityId: string;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  heartRateSeries?: Array<{ elapsedSeconds: number; bpm: number }>;
  distanceTimeSeries?: Array<{ elapsedSeconds: number; distanceMeters: number }>;
  elevationProfile?: Array<{ distanceMeters: number; elevationMeters: number }>;
  route?: Array<{
    latitude: number;
    longitude: number;
    distanceMeters: number;
    elevationMeters?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface GarminWebhookRecord {
  userId?: string;
  userAccessToken?: string;
  uploadStartTimeInSeconds?: number;
  uploadEndTimeInSeconds?: number;
  callbackURL?: string;
  [key: string]: unknown;
}

export type GarminWebhookPayload = Record<string, unknown>;
