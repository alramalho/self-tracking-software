import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  healthWorkout: { findFirst: vi.fn() },
}));
vi.mock("@/utils/prisma", () => ({ prisma: db }));

import { getWorkoutDetail } from "./detail";

const workout = {
  id: "workout-1",
  userId: "owner",
  provider: "garmin_connect",
  activityTypeName: "running",
  startAt: new Date("2026-09-15T07:00:00Z"),
  endAt: new Date("2026-09-15T07:30:00Z"),
  durationSeconds: 1800,
  distanceMeters: 5000,
  activeEnergyKcal: 350,
  sourceName: "Garmin Connect",
  deviceName: "Forerunner",
  timezone: "Europe/Lisbon",
  metadata: {
    averageHeartRateBpm: 168,
    heartRateSeries: [
      { elapsedSeconds: 0, bpm: 140 },
      { elapsedSeconds: 1800, bpm: 176 },
    ],
  },
  reconciliation: {
    action: "link_keep",
    activityEntryId: "entry-1",
    matchReasons: { healthDataIsPublic: true },
    confirmedAt: new Date("2026-09-15T08:00:00Z"),
    activityEntry: {
      id: "entry-1",
      activityId: "run",
      deletedAt: null,
      quantity: 5,
      activity: {
        title: "Morning run",
        emoji: "🏃",
        measure: "kilometers",
        deletedAt: null,
      },
    },
  },
};

describe("workout detail access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.healthWorkout.findFirst.mockResolvedValue(workout);
  });

  it("lets another user inspect a shared linked Garmin workout without editing privacy", async () => {
    const detail = await getWorkoutDetail("viewer", "workout-1");
    expect(detail).toMatchObject({
      healthWorkout: {
        provider: "garmin_connect",
        averageHeartRateBpm: 168,
        heartRateSeries: workout.metadata.heartRateSeries,
      },
      resolved: {
        healthDataIsPublic: true,
        linkedActivity: { title: "Morning run", quantity: 5 },
      },
      isOwner: false,
      canEditPrivacy: false,
    });
  });

  it("keeps private workouts available to their owner only", async () => {
    db.healthWorkout.findFirst.mockResolvedValue({
      ...workout,
      reconciliation: {
        ...workout.reconciliation,
        matchReasons: { healthDataIsPublic: false },
      },
    });
    expect(await getWorkoutDetail("viewer", "workout-1")).toBeNull();
    expect(await getWorkoutDetail("owner", "workout-1")).toMatchObject({
      isOwner: true,
      canEditPrivacy: true,
    });
  });

  it("denies a shared workout after its activity is deleted", async () => {
    db.healthWorkout.findFirst.mockResolvedValue({
      ...workout,
      reconciliation: {
        ...workout.reconciliation,
        activityEntry: {
          ...workout.reconciliation.activityEntry,
          deletedAt: new Date(),
        },
      },
    });
    expect(await getWorkoutDetail("viewer", "workout-1")).toBeNull();
  });

  it("does not fetch deleted or unsupported workouts", async () => {
    db.healthWorkout.findFirst.mockResolvedValue(null);
    expect(await getWorkoutDetail("owner", "workout-1")).toBeNull();
    expect(db.healthWorkout.findFirst.mock.calls[0][0].where).toEqual({
      id: "workout-1",
      provider: { in: ["apple_health", "garmin_connect"] },
      deletedAt: null,
    });
  });
});
