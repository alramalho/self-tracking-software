import type { AxiosInstance } from "axios";

import type {
  AppleHealthStatus,
  AppleHealthSyncBatch,
  AppleHealthSyncTotals,
  PreparedAppleHealthSync,
} from "./types";
import type {
  WorkoutReconciliationApplyResult,
  WorkoutReconciliationDecision,
  WorkoutReconciliationPreview,
} from "./reconciliation/types";

const SYNC_BATCH_SIZE = 100;

const sliceBatch = <T>(values: T[], batchIndex: number): T[] =>
  values.slice(
    batchIndex * SYNC_BATCH_SIZE,
    (batchIndex + 1) * SYNC_BATCH_SIZE,
  );

const getBatchCount = (sync: PreparedAppleHealthSync): number =>
  Math.max(
    1,
    Math.ceil(sync.dailyMetrics.length / SYNC_BATCH_SIZE),
    Math.ceil(sync.workouts.length / SYNC_BATCH_SIZE),
    Math.ceil(sync.sleepSamples.length / SYNC_BATCH_SIZE),
    Math.ceil(sync.deletedWorkoutIds.length / SYNC_BATCH_SIZE),
    Math.ceil(sync.deletedSleepSampleIds.length / SYNC_BATCH_SIZE),
  );

const emptyTotals = (): AppleHealthSyncTotals => ({
  dailyMetrics: 0,
  workouts: 0,
  sleepSamples: 0,
  deletedWorkouts: 0,
  deletedSleepSamples: 0,
});

export async function getAppleHealthStatus(
  api: AxiosInstance,
): Promise<AppleHealthStatus> {
  const response = await api.get<AppleHealthStatus>("/health/apple/status");
  return response.data;
}

export async function uploadPreparedAppleHealthSync(
  api: AxiosInstance,
  sync: PreparedAppleHealthSync,
): Promise<AppleHealthSyncTotals> {
  const batchCount = getBatchCount(sync);
  const totals = emptyTotals();

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const batch: AppleHealthSyncBatch = {
      deviceId: sync.deviceId,
      requestedDataTypes: sync.requestedDataTypes,
      initialSyncStartAt: sync.initialSyncStartAt,
      syncStartedAt: sync.syncStartedAt,
      isFirstBatch: batchIndex === 0,
      isFinalBatch: batchIndex === batchCount - 1,
      dailyMetrics: sliceBatch(sync.dailyMetrics, batchIndex),
      workouts: sliceBatch(sync.workouts, batchIndex),
      sleepSamples: sliceBatch(sync.sleepSamples, batchIndex),
      deletedWorkoutIds: sliceBatch(sync.deletedWorkoutIds, batchIndex),
      deletedSleepSampleIds: sliceBatch(sync.deletedSleepSampleIds, batchIndex),
    };

    const response = await api.post<{
      counts: AppleHealthSyncTotals;
    }>("/health/apple/sync", batch);

    totals.dailyMetrics += response.data.counts.dailyMetrics;
    totals.workouts += response.data.counts.workouts;
    totals.sleepSamples += response.data.counts.sleepSamples;
    totals.deletedWorkouts += response.data.counts.deletedWorkouts;
    totals.deletedSleepSamples += response.data.counts.deletedSleepSamples;
  }

  return totals;
}

export async function disconnectAppleHealth(
  api: AxiosInstance,
  deleteImportedData: boolean,
): Promise<void> {
  await api.delete("/health/apple", {
    params: { deleteData: deleteImportedData },
  });
}

export async function getWorkoutReconciliationPreview(
  api: AxiosInstance,
): Promise<WorkoutReconciliationPreview> {
  const response = await api.get<WorkoutReconciliationPreview>(
    "/health/apple/workouts/reconciliation-preview",
  );
  return response.data;
}

export async function applyWorkoutReconciliations(
  api: AxiosInstance,
  decisions: WorkoutReconciliationDecision[],
): Promise<WorkoutReconciliationApplyResult> {
  const response = await api.post<WorkoutReconciliationApplyResult>(
    "/health/apple/workouts/reconcile",
    { decisions },
  );
  return response.data;
}
