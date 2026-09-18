import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  healthWorkout: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  activityEntry: { findMany: vi.fn() },
}));
vi.mock("@/utils/prisma", () => ({ prisma: db }));

import { getWorkoutReconciliationPreview } from "./service";

const customActivity = {
  id: "movement", userId: "owner", title: "Morning movement", emoji: "🌅",
  measure: "minutes", kind: "other", deletedAt: null,
};
const previousWorkout = {
  id: "previous", activityTypeCode: 37, activityTypeName: "running",
  startAt: new Date("2026-09-14T07:00:00Z"), endAt: new Date("2026-09-14T07:30:00Z"),
  durationSeconds: 1800, distanceMeters: 5000, timezone: "UTC",
  reconciliation: {
    action: "link_keep", activityEntryId: "old-entry", confirmedAt: new Date("2026-09-14T08:00:00Z"),
    activityEntry: { activityId: "movement", userId: "owner", deletedAt: null },
  },
};
const pendingWorkout = {
  ...previousWorkout, id: "pending", reconciliation: null,
  startAt: new Date("2026-09-15T07:00:00Z"), endAt: new Date("2026-09-15T07:30:00Z"),
};

describe("persisted choices in workout previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.healthWorkout.findMany.mockResolvedValue([pendingWorkout, previousWorkout]);
    db.activity.findMany.mockResolvedValue([customActivity]);
    db.activityEntry.findMany.mockResolvedValue([]);
  });

  it("recovers a saved choice from an earlier workout without writing or importing", async () => {
    const preview = await getWorkoutReconciliationPreview("owner");
    expect(preview.items[0].suggestedActivity?.id).toBe("movement");
    expect(preview.items[0].category).toBe("new");
    expect(preview.items[0].resolved).toBeNull();
    expect(preview.items[1].category).toBe("resolved");
    expect(db.healthWorkout.findMany.mock.calls[0][0].where.userId).toBe("owner");
    expect(db.activity.findMany.mock.calls[0][0].where).toEqual({ userId: "owner", deletedAt: null });
  });

  it("offers a same-day log with the remembered custom name as a match", async () => {
    db.activityEntry.findMany.mockResolvedValue([{
      id: "today-entry", activityId: "movement", activity: customActivity,
      quantity: 30, datetime: new Date("2026-09-15T07:30:00Z"), timezone: "UTC",
    }]);
    const item = (await getWorkoutReconciliationPreview("owner")).items[0];
    expect(item.category).toBe("match");
    expect(item.candidates[0].activityEntryId).toBe("today-entry");
    expect(item.recommendedAction).toBe("link_keep");
  });

  it("keeps two possible same-day matches ambiguous despite a remembered activity", async () => {
    db.activityEntry.findMany.mockResolvedValue(["first", "second"].map((id) => ({
      id, activityId: "movement", activity: customActivity,
      quantity: 30, datetime: new Date("2026-09-15T07:30:00Z"), timezone: "UTC",
    })));
    const item = (await getWorkoutReconciliationPreview("owner")).items[0];
    expect(item.category).toBe("conflict");
    expect(item.recommendedAction).toBeNull();
    expect(item.mismatches.some((mismatch) => mismatch.code === "ambiguous_match")).toBe(true);
  });

  it.each(["ignored", "deleted", "foreign"])("does not learn from %s history", async (reason) => {
    db.healthWorkout.findMany.mockResolvedValue([pendingWorkout, {
      ...previousWorkout,
      reconciliation: {
        ...previousWorkout.reconciliation,
        action: reason === "ignored" ? "ignore" : "link_keep",
        activityEntry: {
          ...previousWorkout.reconciliation.activityEntry,
          deletedAt: reason === "deleted" ? new Date() : null,
          userId: reason === "foreign" ? "another-user" : "owner",
        },
      },
    }]);
    expect((await getWorkoutReconciliationPreview("owner")).items[0].suggestedActivity).toBeNull();
  });
});
