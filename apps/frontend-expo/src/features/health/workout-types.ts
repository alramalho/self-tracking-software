export type WorkoutReconciliationAction =
  | "link_keep"
  | "link_use_health"
  | "import_new"
  | "ignore";

export type WorkoutReconciliationCategory =
  | "match"
  | "new"
  | "conflict"
  | "resolved";

export interface WorkoutMismatch {
  code:
    | "rounded_value"
    | "value_mismatch"
    | "unit_incompatible"
    | "ambiguous_match"
    | "possible_duplicate";
  label: string;
  severity: "info" | "warning" | "conflict";
}

export interface HeartRateZones {
  estimatedMaxHeartRateBpm: number;
  source: "age_estimate" | "default";
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}

export interface ElevationProfilePoint {
  distanceMeters: number;
  elevationMeters: number;
}

export interface HeartRateSeriesPoint {
  elapsedSeconds: number;
  bpm: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  elevationMeters?: number;
}

export interface HealthWorkoutPreview {
  id: string;
  provider?: string;
  activityTypeName: string;
  displayName: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  distanceMeters: number | null;
  activeEnergyKcal: number | null;
  elevationAscendedMeters?: number | null;
  elevationDescendedMeters?: number | null;
  effortScore?: number | null;
  effortSource?: "user" | "apple_estimated" | null;
  difficulty?: "very_easy" | "easy" | "moderate" | "hard" | "very_hard" | null;
  averageHeartRateBpm?: number | null;
  maximumHeartRateBpm?: number | null;
  heartRateZones?: HeartRateZones | null;
  heartRateSeries?: HeartRateSeriesPoint[] | null;
  elevationProfile?: ElevationProfilePoint[] | null;
  route?: RoutePoint[] | null;
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

export interface WorkoutReconciliationApplyResult {
  linked: number;
  imported: number;
  ignored: number;
  alreadyResolved: number;
}

export type WorkoutReviewAction = WorkoutReconciliationAction | "skip";

export interface WorkoutReviewSelection {
  action: WorkoutReviewAction;
  activityEntryId?: string;
  activityId?: string;
}

export interface AppleHealthWorkoutReconciliationProps {
  enabled: boolean;
  openRequestKey: number;
}
