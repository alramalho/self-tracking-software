import type { AxiosInstance } from "axios";
import type { PreparedAppleHealthSync } from "@/native/health/types";

export async function uploadHealth(
  client: AxiosInstance,
  prepared: PreparedAppleHealthSync,
  checkAccount: () => void,
) {
  const groups = [
    prepared.workouts,
    prepared.sleepSamples,
    prepared.deletedWorkoutIds,
    prepared.deletedSleepSampleIds,
  ];
  const count = Math.max(
    1,
    ...groups.map((items) => Math.ceil(items.length / 100)),
  );
  for (let index = 0; index < count; index++) {
    checkAccount();
    const slice = <T>(items: T[]) =>
      items.slice(index * 100, (index + 1) * 100);
    await client.post("/health/apple/sync", {
      deviceId: prepared.deviceId,
      requestedDataTypes: prepared.requestedDataTypes,
      initialSyncStartAt: prepared.initialSyncStartAt,
      syncStartedAt: prepared.syncStartedAt,
      isFirstBatch: index === 0,
      isFinalBatch: index === count - 1,
      dailyMetrics: [],
      workouts: slice(prepared.workouts),
      sleepSamples: slice(prepared.sleepSamples),
      deletedWorkoutIds: slice(prepared.deletedWorkoutIds),
      deletedSleepSampleIds: slice(prepared.deletedSleepSampleIds),
    });
  }
  checkAccount();
}
