import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  sendPush: vi.fn(),
  canAccess: vi.fn(),
}));
vi.mock("../../utils/prisma", () => ({
  prisma: {
    notification: {
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      update: mocks.update,
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));
vi.mock("../notificationService", () => ({
  notificationService: { sendPushNotification: mocks.sendPush },
}));
vi.mock("./visibility", () => ({
  canRecipientAccessPhotoNotification: mocks.canAccess,
}));
vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn() },
}));

import {
  processPhotoNotification,
  retryPendingPhotoNotifications,
} from "./delivery";

const now = new Date("2026-09-23T12:00:00Z");
const record = (attempts = 1) => ({
  id: "photo-notification",
  dedupeKey: "ACTIVITY_PHOTO:entry:friend",
  status: "PENDING",
  deliveryAttempts: attempts,
  title: null,
  message: "Photo added",
  user: {
    id: "friend",
    name: "Friend",
    username: "friend",
    isIosNotificationsEnabled: true,
    iosDeviceToken: "ios-token",
    isPwaNotificationsEnabled: false,
    pwaSubscriptionEndpoint: null,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUniqueOrThrow.mockResolvedValue(record());
  mocks.update.mockResolvedValue({});
  mocks.sendPush.mockResolvedValue({ platform: "ios" });
  mocks.findMany.mockResolvedValue([]);
  mocks.canAccess.mockResolvedValue(true);
});

describe("photo push delivery lease", () => {
  it("claims once before push and marks success with a send time", async () => {
    expect(await processPhotoNotification("photo-notification", now)).toBe(
      true,
    );
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "photo-notification",
          status: "PENDING",
          deliveryAttempts: { lt: 3 },
        }),
        data: { deliveryClaimedAt: now, deliveryAttempts: { increment: 1 } },
      }),
    );
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROCESSED",
          sentAt: expect.any(Date),
        }),
      }),
    );
  });

  it("keeps the record pending after a transient failure and retries after the delay", async () => {
    mocks.sendPush.mockRejectedValueOnce(new Error("temporary APNs error"));
    expect(await processPhotoNotification("photo-notification", now)).toBe(
      false,
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          deliveryClaimedAt: null,
          nextDeliveryAttemptAt: new Date("2026-09-23T12:02:00Z"),
        }),
      }),
    );
    mocks.findUniqueOrThrow.mockResolvedValue(record(2));
    expect(
      await processPhotoNotification(
        "photo-notification",
        new Date("2026-09-23T12:02:00Z"),
      ),
    ).toBe(true);
    expect(mocks.sendPush).toHaveBeenCalledTimes(2);
  });

  it("does not send during another claim and permits a stale interrupted claim", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    expect(await processPhotoNotification("photo-notification", now)).toBe(
      false,
    );
    expect(mocks.sendPush).not.toHaveBeenCalled();
    mocks.findUniqueOrThrow.mockResolvedValue(record(2));
    expect(
      await processPhotoNotification(
        "photo-notification",
        new Date("2026-09-23T12:05:01Z"),
      ),
    ).toBe(true);
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  deliveryClaimedAt: { lte: new Date("2026-09-23T12:00:01Z") },
                },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("keeps the inbox record after the third failed attempt", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue(record(3));
    mocks.sendPush.mockRejectedValue(new Error("unavailable"));
    expect(await processPhotoNotification("photo-notification", now)).toBe(
      false,
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROCESSED",
          nextDeliveryAttemptAt: null,
        }),
      }),
    );
  });

  it("retires a notification if access was revoked before retry", async () => {
    mocks.canAccess.mockResolvedValue(false);
    expect(await processPhotoNotification("photo-notification", now)).toBe(
      false,
    );
    expect(mocks.sendPush).not.toHaveBeenCalled();
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "photo-notification", status: "PENDING" },
    });
  });

  it("sweeps an abandoned final claim and retries due records", async () => {
    mocks.findMany.mockResolvedValue([{ id: "photo-notification" }]);
    await retryPendingPhotoNotifications(now);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryAttempts: { gte: 3 } }),
      }),
    );
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryAttempts: { lt: 3 } }),
      }),
    );
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
  });
});
