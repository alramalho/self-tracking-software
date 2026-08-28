import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/utils/prisma";

import { disconnectAppleHealth } from "../syncService";
import {
  applyWorkoutReconciliations,
  getWorkoutReconciliationPreview,
} from "./service";

const TEST_USER_ID = "test-health-reconciliation-user";

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

async function createTestUser(): Promise<void> {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: `${TEST_USER_ID}@test.local`,
      username: TEST_USER_ID,
      timezone: "Europe/Warsaw",
    },
  });
}

describe("Apple Health workout reconciliation persistence", () => {
  beforeEach(async () => {
    await cleanup();
    await createTestUser();
  });

  afterEach(cleanup);

  it("links a rounded run without overwriting user-authored fields", async () => {
    const activity = await prisma.activity.create({
      data: {
        userId: TEST_USER_ID,
        title: "running",
        emoji: "🏃",
        measure: "kilometers",
        kind: "other",
      },
    });
    const entry = await prisma.activityEntry.create({
      data: {
        userId: TEST_USER_ID,
        activityId: activity.id,
        quantity: 6,
        datetime: new Date("2026-07-09T17:36:00.000Z"),
        timezone: "Europe/Warsaw",
        description: "Fastest 5K",
        privateNotes: "Felt strong",
      },
    });
    const workout = await prisma.healthWorkout.create({
      data: {
        userId: TEST_USER_ID,
        externalId: "test-july-9-run",
        activityTypeCode: 37,
        activityTypeName: "running",
        startAt: new Date("2026-07-09T17:06:33.000Z"),
        endAt: new Date("2026-07-09T17:36:02.000Z"),
        durationSeconds: 1768.823,
        distanceMeters: 5884.797,
        sourceBundleId: "com.apple.health",
        sourceName: "Apple Watch",
        timezone: "Europe/Warsaw",
      },
    });

    const preview = await getWorkoutReconciliationPreview(TEST_USER_ID);
    expect(preview.summary.matches).toBe(1);
    expect(preview.items[0].mismatches[0]?.code).toBe("rounded_value");

    const result = await applyWorkoutReconciliations(TEST_USER_ID, [
      {
        healthWorkoutId: workout.id,
        activityEntryId: entry.id,
        action: "link_keep",
      },
    ]);
    expect(result.linked).toBe(1);

    const linkedEntry = await prisma.activityEntry.findUniqueOrThrow({
      where: { id: entry.id },
    });
    expect(linkedEntry.quantity).toBe(6);
    expect(linkedEntry.description).toBe("Fastest 5K");
    expect(linkedEntry.privateNotes).toBe("Felt strong");
    expect(linkedEntry.distanceMeters).toBeCloseTo(5884.797, 3);
    expect(linkedEntry.durationSeconds).toBe(1769);

    const retry = await applyWorkoutReconciliations(TEST_USER_ID, [
      {
        healthWorkoutId: workout.id,
        activityEntryId: entry.id,
        action: "link_keep",
      },
    ]);
    expect(retry.alreadyResolved).toBe(1);
  });

  it("imports a new workout and deletes only Apple-created timeline entries", async () => {
    const manualActivity = await prisma.activity.create({
      data: {
        userId: TEST_USER_ID,
        title: "Manual note",
        emoji: "✍️",
        measure: "sessions",
      },
    });
    const manualEntry = await prisma.activityEntry.create({
      data: {
        userId: TEST_USER_ID,
        activityId: manualActivity.id,
        quantity: 1,
        datetime: new Date("2026-07-10T12:00:00.000Z"),
        source: "app",
      },
    });
    const workout = await prisma.healthWorkout.create({
      data: {
        userId: TEST_USER_ID,
        externalId: "test-cycling-workout",
        activityTypeCode: 13,
        activityTypeName: "cycling",
        startAt: new Date("2026-07-10T08:00:00.000Z"),
        endAt: new Date("2026-07-10T08:45:00.000Z"),
        durationSeconds: 2700,
        distanceMeters: 20_120,
        sourceBundleId: "com.apple.health",
        sourceName: "Apple Watch",
        timezone: "Europe/Warsaw",
      },
    });

    const result = await applyWorkoutReconciliations(TEST_USER_ID, [
      { healthWorkoutId: workout.id, action: "import_new" },
    ]);
    expect(result.imported).toBe(1);

    const importedEntry = await prisma.activityEntry.findFirstOrThrow({
      where: { userId: TEST_USER_ID, source: "apple_health" },
      include: { activity: true },
    });
    expect(importedEntry.quantity).toBe(20);
    expect(importedEntry.distanceMeters).toBe(20_120);
    expect(importedEntry.activity?.title).toBe("Cycling");
    const importedActivityId = importedEntry.activityId;

    await disconnectAppleHealth(TEST_USER_ID, true);

    expect(
      await prisma.activityEntry.findUnique({ where: { id: importedEntry.id } }),
    ).toBeNull();
    expect(
      await prisma.activityEntry.findUnique({ where: { id: manualEntry.id } }),
    ).not.toBeNull();
    expect(
      await prisma.activity.findUnique({
        where: { id: importedActivityId ?? undefined },
      }),
    ).toBeNull();
  });
});
