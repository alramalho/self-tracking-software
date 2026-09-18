import type { AppleHealthStatus } from "@/native/health/types";

export interface GarminImportStats {
  workoutCount: number;
  sleepDayCount: number;
  sleepSampleCount: number;
  dailyMetricCount: number;
  signalTypeCount: number;
  dataStartDate: string | null;
  dataEndDate: string | null;
}

export interface GarminStatus {
  available: boolean;
  connected: boolean;
  permissions: string[];
  connectedAt: string | null;
  initialSyncStartedAt: string | null;
  backfillRequestedAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  lastSyncError: string | null;
  importStats: GarminImportStats;
}

export interface GarminSyncResult {
  counts: {
    dailyMetrics: number;
    workouts: number;
    sleepSamples: number;
    summaryTypes: number;
    backfillRequested: boolean;
  };
  lastSyncCompletedAt: string | null;
}

export interface GarminContextValue {
  status: GarminStatus | undefined;
  lastSyncResult: GarminSyncResult | null;
  busy: boolean;
  error: unknown;
  connect: () => Promise<void>;
  sync: () => Promise<void>;
  disconnect: (deleteData: boolean) => Promise<boolean>;
}

export interface HealthContextValue {
  available: boolean;
  enabled: boolean;
  busy: boolean;
  error: unknown;
  status: AppleHealthStatus | undefined;
  connect: () => Promise<void>;
  sync: () => Promise<void>;
  disconnect: (deleteData: boolean) => Promise<boolean>;
  garmin: GarminContextValue;
}

export interface WorkoutReviewProps {
  item: import("./workout-types").WorkoutReconciliationPreviewItem;
  items?: import("./workout-types").WorkoutReconciliationPreviewItem[];
  onClose: () => void;
}
