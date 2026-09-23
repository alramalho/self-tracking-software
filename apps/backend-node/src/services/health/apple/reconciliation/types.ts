import type {
  AppleHealthElevationProfilePoint,
  AppleHealthHeartRateSeriesPoint,
  AppleHealthDistanceTimePoint,
  AppleHealthHeartRateZones,
  AppleHealthRoutePoint,
} from "../types";

export const WORKOUT_RECONCILIATION_ACTIONS = [
  "link_keep",
  "link_use_health",
  "import_new",
  "ignore",
] as const;

export type WorkoutReconciliationAction =
  (typeof WORKOUT_RECONCILIATION_ACTIONS)[number];

export type WorkoutReconciliationCategory =
  | "match"
  | "new"
  | "conflict"
  | "resolved";

export type WorkoutMismatchSeverity = "info" | "warning" | "conflict";

export type WorkoutMismatchCode =
  | "rounded_value"
  | "value_mismatch"
  | "unit_incompatible"
  | "ambiguous_match"
  | "possible_duplicate";

export interface WorkoutMismatch {
  code: WorkoutMismatchCode;
  label: string;
  severity: WorkoutMismatchSeverity;
}

export interface HealthWorkoutPreview {
  id: string;
  provider: string;
  activityTypeName: string;
  displayName: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  activeEnergyKcal: number | null;
  elevationAscendedMeters: number | null;
  elevationDescendedMeters: number | null;
  effortScore: number | null;
  effortSource: "user" | "apple_estimated" | null;
  difficulty: "very_easy" | "easy" | "moderate" | "hard" | "very_hard" | null;
  averageHeartRateBpm: number | null;
  maximumHeartRateBpm: number | null;
  heartRateZones: AppleHealthHeartRateZones | null;
  heartRateSeries: AppleHealthHeartRateSeriesPoint[] | null;
  distanceTimeSeries: AppleHealthDistanceTimePoint[] | null;
  elevationProfile: AppleHealthElevationProfilePoint[] | null;
  route: AppleHealthRoutePoint[] | null;
  sourceName: string | null;
  deviceName: string | null;
  timezone: string | null;
}

export interface WorkoutMeasurementComparison {
  compatible: boolean;
  healthValue: number | null;
  healthUnit: string | null;
  trackingValue: number;
  trackingUnit: string;
  differencePercent: number | null;
  withinTolerance: boolean | null;
}

export interface TrackingWorkoutCandidate {
  activityEntryId: string;
  activityId: string | null;
  activityTitle: string;
  activityEmoji: string;
  activityMeasure: string;
  quantity: number;
  datetime: string;
  timezone: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  score: number;
  timeDifferenceMinutes: number;
  comparison: WorkoutMeasurementComparison;
}

export interface SuggestedActivity {
  id: string;
  title: string;
  emoji: string;
  measure: string;
}

export interface ConfirmedWorkoutActivityMatch {
  activityTypeCode: number;
  activityId: string;
  confirmedAt: Date;
}

export type WorkoutActivitySuggestionInput = Pick<
  import("@tsw/prisma").HealthWorkout,
  "activityTypeCode" | "activityTypeName" | "distanceMeters" | "durationSeconds"
>;

export interface ResolvedWorkoutReconciliation {
  action: WorkoutReconciliationAction;
  activityEntryId: string | null;
  healthDataIsPublic: boolean;
  linkedActivity: {
    title: string;
    emoji: string;
    measure: string;
    quantity: number;
  } | null;
  confirmedAt: string;
}

export interface WorkoutReconciliationPreviewItem {
  healthWorkout: HealthWorkoutPreview;
  category: WorkoutReconciliationCategory;
  confidence: number;
  mismatches: WorkoutMismatch[];
  candidates: TrackingWorkoutCandidate[];
  suggestedActivity: SuggestedActivity | null;
  recommendedAction: WorkoutReconciliationAction | null;
  resolved: ResolvedWorkoutReconciliation | null;
  shareHealthDataByDefault: boolean;
}

export interface WorkoutReconciliationPreviewSummary {
  total: number;
  pending: number;
  matches: number;
  newWorkouts: number;
  conflicts: number;
  resolved: number;
}

export interface WorkoutReconciliationPreview {
  summary: WorkoutReconciliationPreviewSummary;
  items: WorkoutReconciliationPreviewItem[];
}

export interface WorkoutReconciliationDecision {
  healthWorkoutId: string;
  action: WorkoutReconciliationAction;
  activityEntryId?: string;
  activityId?: string;
  newActivity?: {
    title: string;
    measure: "minutes" | "kilometers" | "sessions";
  };
  shareHealthData?: boolean;
}

export interface WorkoutPrivacyUpdate {
  healthWorkoutId: string;
  shareHealthData: boolean;
  makeDefault: boolean;
}

export interface WorkoutPrivacyUpdateResult {
  healthDataIsPublic: boolean;
  shareHealthDataByDefault: boolean;
}

export interface WorkoutReconciliationApplyResult {
  linked: number;
  imported: number;
  ignored: number;
  alreadyResolved: number;
}

export interface NormalizedWorkoutMeasurement {
  value: number;
  unit: string;
  baseValue: number;
  baseUnit: "meters" | "seconds" | "sessions";
}

export interface ResolvedTargetActivity {
  activity: Activity;
  created: boolean;
}
import type { Activity } from "@tsw/prisma";
