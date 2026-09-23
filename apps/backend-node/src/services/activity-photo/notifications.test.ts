import { ActivityEntry } from "@tsw/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  planFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  notificationFindUnique: vi.fn(),
  createNotification: vi.fn(),
  processNotification: vi.fn(),
}));

vi.mock("../../utils/prisma", () => ({
  prisma: {
    plan: { findMany: mocks.planFindMany },
    user: { findUnique: mocks.userFindUnique },
    notification: { findUnique: mocks.notificationFindUnique },
  },
}));
vi.mock("../notificationService", () => ({
  notificationService: {
    createNotification: mocks.createNotification,
  },
}));
vi.mock("./delivery", () => ({
  processPhotoNotification: mocks.processNotification,
}));
vi.mock("../../utils/logger", () => ({ logger: { error: vi.fn() } }));

import { notifyConnectionsAboutActivityPhotos } from "./notifications";

const now = new Date("2026-09-23T12:00:00Z");
const user = {
  id: "owner",
  username: "alex",
  name: "Alex",
  picture: "https://example.test/avatar.png",
  timezone: "Europe/Lisbon",
};
const activity = {
  id: "activity-1",
  title: "Running",
  emoji: "🏃",
  measure: "km",
  deletedAt: null,
};
const entry = {
  id: "entry-1",
  activityId: activity.id,
  userId: user.id,
  datetime: new Date("2026-09-23T10:00:00Z"),
  createdAt: new Date("2026-09-23T10:01:00Z"),
  timezone: "Europe/Lisbon",
  deletedAt: null,
  imageUrl: "https://example.test/photo.jpg",
  imageUrls: ["https://example.test/photo.jpg"],
} as ActivityEntry;

const send = (
  overrides: Partial<
    Parameters<typeof notifyConnectionsAboutActivityPhotos>[0]
  > = {},
) =>
  notifyConnectionsAboutActivityPhotos({
    user,
    activity,
    entry,
    now,
    ...overrides,
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.planFindMany.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue({
    connectionsFrom: [{ to: { id: "friend-a", deletedAt: null } }],
    connectionsTo: [
      { from: { id: "friend-a", deletedAt: null } },
      { from: { id: "friend-b", deletedAt: null } },
    ],
  });
  mocks.createNotification.mockImplementation(async (data) => ({
    id: data.dedupeKey,
    status: "PENDING",
  }));
  mocks.processNotification.mockResolvedValue({ status: "PROCESSED" });
});

describe("photo notification record and payload", () => {
  it("creates one record per accepted friend with an entry-scoped key", async () => {
    await send();
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.processNotification).toHaveBeenCalledTimes(2);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "friend-a",
        relatedId: "entry-1",
        dedupeKey: "ACTIVITY_PHOTO:entry-1:friend-a",
        relatedData: expect.objectContaining({
          activityEntryId: "entry-1",
          userUsername: "alex",
          category: "ACTIVITY_PHOTO",
        }),
      }),
    );
    expect(mocks.planFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "owner",
          activities: { some: { id: "activity-1" } },
        }),
      }),
    );
  });

  it("suppresses private-plan and stale-day photos before loading friends", async () => {
    mocks.planFindMany.mockResolvedValue([{ visibility: "PRIVATE" }]);
    await send();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    mocks.planFindMany.mockClear();
    await send({
      entry: { ...entry, datetime: new Date("2026-09-22T10:00:00Z") },
    });
    expect(mocks.planFindMany).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("uses the recorded end for a live workout crossing local midnight", async () => {
    await send({
      entry: {
        ...entry,
        datetime: new Date("2026-09-22T22:30:00Z"),
        endedAt: new Date("2026-09-22T23:10:00Z"),
        timezone: "Europe/Lisbon",
      },
      now: new Date("2026-09-23T00:00:00Z"),
    });
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
  });

  it("allows a public plan even when the activity is also in a private plan", async () => {
    mocks.planFindMany.mockResolvedValue([
      { visibility: "PRIVATE" },
      { visibility: "PUBLIC" },
    ]);
    await send();
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
  });

  it("reuses an existing notification after a repeated upload or request retry", async () => {
    mocks.createNotification.mockRejectedValue({ code: "P2002" });
    mocks.notificationFindUnique.mockResolvedValue({
      id: "existing",
      status: "PROCESSED",
    });
    await send();
    expect(mocks.notificationFindUnique).toHaveBeenCalledTimes(2);
    expect(mocks.processNotification).not.toHaveBeenCalled();
  });

  it("can resume a pending record without producing a second record", async () => {
    mocks.createNotification.mockRejectedValue({ code: "P2002" });
    mocks.notificationFindUnique.mockResolvedValue({
      id: "pending",
      status: "PENDING",
    });
    await send();
    expect(mocks.processNotification).toHaveBeenCalledTimes(2);
  });

  it("reports failed record creation so receipt replay can be retried", async () => {
    mocks.createNotification.mockRejectedValue(new Error("database unavailable"));
    await expect(send()).rejects.toThrow(
      "Could not queue photo notifications for entry entry-1",
    );
  });
});
