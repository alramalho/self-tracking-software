import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/utils/prisma";
import { getSleepScores, updateSleepScores } from "./service";
import { applyWorkoutReconciliations } from "../reconciliation/service";
import { disconnectAppleHealth } from "../syncService";
import { healthSafeActivityFilter } from "../ai-boundary";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
) {
  throw new Error(
    "Health persistence tests require the isolated local test database on port 55432.",
  );
}
const userId = "health-v0-integration-user";
async function cleanup() {
  await prisma.user.deleteMany({ where: { id: userId } });
}
describe("Health v0 persistence", () => {
  beforeEach(async () => {
    await cleanup();
    await prisma.user.create({
      data: { id: userId, email: `${userId}@test.local`, username: userId },
    });
  });
  afterEach(cleanup);
  it("stores nullable scores, updates without duplicate days and removes deleted-source scores", async () => {
    await prisma.healthSleepSample.createMany({
      data: Array.from({ length: 8 }, (_, i) => ({
        userId,
        externalId: `sleep-${i}`,
        stageCode: 3,
        stage: "asleep_core",
        startAt: new Date(Date.UTC(2026, 7, i + 1, 23)),
        endAt: new Date(Date.UTC(2026, 7, i + 2, 7)),
        sourceBundleId: "com.apple.health",
        sourceName: "Apple Watch",
        timezone: "UTC",
      })),
    });
    await updateSleepScores(userId);
    await updateSleepScores(userId);
    let result = await getSleepScores(userId);
    expect(result.scores).toHaveLength(8);
    expect(result.scores[0].total).toBe(100);
    expect(result.scores.at(-1)?.total).toBeNull();
    await prisma.healthSleepSample.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });
    await updateSleepScores(userId);
    result = await getSleepScores(userId);
    expect(result.scores).toHaveLength(0);
  });
  it("serializes repeated confirmation and creates the custom activity exactly once", async () => {
    const workout = await prisma.healthWorkout.create({
      data: {
        userId,
        externalId: "custom-workout",
        activityTypeCode: 50,
        activityTypeName: "traditional_strength_training",
        startAt: new Date("2026-08-01T08:00:00Z"),
        endAt: new Date("2026-08-01T08:40:00Z"),
        durationSeconds: 2400,
        sourceBundleId: "com.apple.health",
        timezone: "UTC",
      },
    });
    const decision = {
      healthWorkoutId: workout.id,
      action: "import_new" as const,
      newActivity: { title: "My gym routine", measure: "minutes" as const },
    };
    const results = await Promise.all([
      applyWorkoutReconciliations(userId, [decision]),
      applyWorkoutReconciliations(userId, [decision]),
    ]);
    expect(results.reduce((sum, value) => sum + value.imported, 0)).toBe(1);
    expect(results.reduce((sum, value) => sum + value.alreadyResolved, 0)).toBe(
      1,
    );
    expect(await prisma.activity.count({ where: { userId } })).toBe(1);
    const entries = await prisma.activityEntry.findMany({ where: { userId } });
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(40);
    expect(
      await prisma.activityEntry.count({
        where: { userId, ...healthSafeActivityFilter },
      }),
    ).toBe(0);
    await disconnectAppleHealth(userId, true);
    expect(await prisma.activityEntry.count({ where: { userId } })).toBe(0);
  });
  it("keeps a linked manual log excluded from AI after imported history is removed", async () => {
    const activity = await prisma.activity.create({
      data: { userId, title: "Running", emoji: "🏃", measure: "kilometers" },
    });
    const entry = await prisma.activityEntry.create({
      data: {
        userId,
        activityId: activity.id,
        quantity: 4,
        datetime: new Date("2026-08-01T08:00:00Z"),
      },
    });
    const workout = await prisma.healthWorkout.create({
      data: {
        userId,
        externalId: "linked-workout",
        activityTypeCode: 37,
        activityTypeName: "running",
        startAt: new Date("2026-08-01T08:00:00Z"),
        endAt: new Date("2026-08-01T08:30:00Z"),
        durationSeconds: 1800,
        distanceMeters: 5100,
        sourceBundleId: "com.apple.health",
        timezone: "UTC",
      },
    });
    await applyWorkoutReconciliations(userId, [
      {
        healthWorkoutId: workout.id,
        action: "link_use_health",
        activityEntryId: entry.id,
      },
    ]);
    await disconnectAppleHealth(userId, true);
    const kept = await prisma.activityEntry.findUniqueOrThrow({
      where: { id: entry.id },
    });
    expect(kept.source).toBe("apple_health_linked");
    expect(kept.quantity).toBe(5);
    expect(
      await prisma.activityEntry.count({
        where: { userId, ...healthSafeActivityFilter },
      }),
    ).toBe(0);
  });
});
