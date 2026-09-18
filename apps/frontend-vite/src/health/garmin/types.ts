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
