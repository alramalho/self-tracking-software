import { test } from "node:test";
import assert from "node:assert/strict";
import type { AxiosInstance } from "axios";
import type { PreparedAppleHealthSync } from "../src/native/health/types";
import { uploadHealth } from "../src/features/health/upload";

function prepared() {
  return {
    deviceId: "test-device",
    syncToken: "pending",
    requestedDataTypes: ["workout", "sleep_analysis"],
    initialSyncStartAt: "2026-08-01T00:00:00Z",
    syncStartedAt: "2026-09-01T00:00:00Z",
    workouts: [],
    sleepSamples: [],
    dailyMetrics: [],
    deletedWorkoutIds: [],
    deletedSleepSampleIds: [],
  } as PreparedAppleHealthSync;
}

test("uploads an empty final batch so deletions and initial sync can complete", async () => {
  const payloads: Record<string, unknown>[] = [];
  const client = {
    post: async (_path: string, body: Record<string, unknown>) => {
      payloads.push(body);
    },
  } as AxiosInstance;
  await uploadHealth(client, prepared(), () => {});
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].isFirstBatch, true);
  assert.equal(payloads[0].isFinalBatch, true);
});

test("batches every deletion exactly once and stops when accounts change", async () => {
  const sync = prepared();
  sync.deletedWorkoutIds = Array.from(
    { length: 205 },
    (_, i) => `workout-${i}`,
  );
  const payloads: {
    deletedWorkoutIds: string[];
    isFirstBatch: boolean;
    isFinalBatch: boolean;
  }[] = [];
  const client = {
    post: async (_path: string, body: (typeof payloads)[number]) => {
      payloads.push(body);
    },
  } as AxiosInstance;
  await uploadHealth(client, sync, () => {});
  assert.deepEqual(
    payloads.flatMap((p) => p.deletedWorkoutIds),
    sync.deletedWorkoutIds,
  );
  assert.deepEqual(
    payloads.map((p) => [p.isFirstBatch, p.isFinalBatch]),
    [
      [true, false],
      [false, false],
      [false, true],
    ],
  );
  payloads.length = 0;
  await assert.rejects(
    uploadHealth(client, sync, () => {
      if (payloads.length) throw new Error("Account changed");
    }),
    /Account changed/,
  );
  assert.equal(payloads.length, 1);
});

test("failed uploads reject before later batches can run", async () => {
  const sync = prepared();
  sync.deletedSleepSampleIds = Array.from(
    { length: 205 },
    (_, i) => `sleep-${i}`,
  );
  let uploads = 0;
  const client = {
    post: async () => {
      uploads++;
      throw new Error("Offline");
    },
  } as unknown as AxiosInstance;
  await assert.rejects(
    uploadHealth(client, sync, () => {}),
    /Offline/,
  );
  assert.equal(uploads, 1);
});
