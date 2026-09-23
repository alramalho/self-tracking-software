import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";
import { notificationService } from "../notificationService";
import {
  processPhotoNotification,
  retryPendingPhotoNotifications,
} from "./delivery";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55433" ||
  database.pathname !== "/tracking_photo_test"
) {
  throw new Error(
    "Photo notification persistence tests require the isolated local test database on port 55433.",
  );
}

const userId = "photo-notification-integration-user";
const ownerId = "photo-notification-integration-owner";
const activityId = "photo-notification-integration-activity";
const now = new Date("2026-09-23T12:00:00Z");
let sendPush: ReturnType<typeof vi.spyOn>;

async function createRecord(
  suffix: string,
  fields: Record<string, unknown> = {},
) {
  await prisma.activityEntry.createMany({
    data: [
      {
        id: `entry-${suffix}`,
        userId: ownerId,
        activityId,
        quantity: 1,
        datetime: now,
        imageUrl: "https://example.test/photo.jpg",
        imageUrls: ["https://example.test/photo.jpg"],
      },
    ],
    skipDuplicates: true,
  });
  return prisma.notification.create({
    data: {
      userId,
      message: "Photo added",
      type: "INFO",
      relatedId: `entry-${suffix}`,
      dedupeKey: `ACTIVITY_PHOTO:entry-${suffix}:${userId}`,
      status: "PENDING",
      ...fields,
    },
  });
}

describe("photo notification database claims", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, ownerId] } } });
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@test.local`,
        username: ownerId,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.local`,
        username: userId,
        isIosNotificationsEnabled: true,
        iosDeviceToken: "stubbed-ios-token",
      },
    });
    await prisma.activity.create({
      data: {
        id: activityId,
        userId: ownerId,
        title: "Running",
        emoji: "🏃",
        measure: "km",
      },
    });
    await prisma.connection.create({
      data: { fromId: ownerId, toId: userId, status: "ACCEPTED" },
    });
    sendPush = vi
      .spyOn(notificationService, "sendPushNotification")
      .mockResolvedValue({
        platform: "ios",
        message: "stubbed",
      });
  });

  afterAll(async () => {
    sendPush?.mockRestore();
    await prisma.user.deleteMany({ where: { id: { in: [userId, ownerId] } } });
    await prisma.$disconnect();
  });

  it("enforces one inbox record for concurrent repeated uploads", async () => {
    const attempts = await Promise.allSettled([
      createRecord("unique"),
      createRecord("unique"),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.notification.count({
        where: { dedupeKey: `ACTIVITY_PHOTO:entry-unique:${userId}` },
      }),
    ).toBe(1);
    await prisma.notification.update({
      where: { dedupeKey: `ACTIVITY_PHOTO:entry-unique:${userId}` },
      data: { status: "PROCESSED" },
    });
  });

  it("claims once under concurrent processors and leaves a sent record", async () => {
    const notification = await createRecord("concurrent");
    const results = await Promise.all([
      processPhotoNotification(notification.id, now),
      processPhotoNotification(notification.id, now),
    ]);
    expect(results.sort()).toEqual([false, true]);
    const saved = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(saved.status).toBe("PROCESSED");
    expect(saved.deliveryAttempts).toBe(1);
    expect(saved.sentAt).not.toBeNull();
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure only after its due time", async () => {
    const notification = await createRecord("retry");
    sendPush.mockRejectedValueOnce(new Error("temporary APNs failure"));
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    let saved = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(saved.status).toBe("PENDING");
    expect(saved.deliveryAttempts).toBe(1);
    expect(saved.nextDeliveryAttemptAt).toEqual(
      new Date("2026-09-23T12:02:00Z"),
    );
    expect(
      await processPhotoNotification(
        notification.id,
        new Date("2026-09-23T12:01:59Z"),
      ),
    ).toBe(false);
    expect(
      await processPhotoNotification(
        notification.id,
        new Date("2026-09-23T12:02:00Z"),
      ),
    ).toBe(true);
    saved = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(saved.status).toBe("PROCESSED");
    expect(saved.deliveryAttempts).toBe(2);
  });

  it("recovers an interrupted claim after the five-minute lease", async () => {
    const notification = await createRecord("interrupted", {
      deliveryAttempts: 1,
      deliveryClaimedAt: now,
    });
    expect(
      await processPhotoNotification(
        notification.id,
        new Date("2026-09-23T12:04:59Z"),
      ),
    ).toBe(false);
    expect(
      await processPhotoNotification(
        notification.id,
        new Date("2026-09-23T12:05:01Z"),
      ),
    ).toBe(true);
    const saved = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(saved.deliveryAttempts).toBe(2);
    expect(saved.status).toBe("PROCESSED");
  });

  it("removes a pending photo alert if the friendship is revoked before retry", async () => {
    const notification = await createRecord("revoked-connection");
    sendPush.mockRejectedValueOnce(new Error("temporary APNs failure"));
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    await prisma.connection.update({
      where: { fromId_toId: { fromId: ownerId, toId: userId } },
      data: { status: "BLOCKED" },
    });
    const sendsBefore = sendPush.mock.calls.length;
    expect(
      await processPhotoNotification(
        notification.id,
        new Date("2026-09-23T12:02:00Z"),
      ),
    ).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
    expect(
      await prisma.notification.findUnique({ where: { id: notification.id } }),
    ).toBeNull();
    await prisma.connection.update({
      where: { fromId_toId: { fromId: ownerId, toId: userId } },
      data: { status: "ACCEPTED" },
    });
  });

  it("removes a pending photo alert if its entry is deleted", async () => {
    const notification = await createRecord("deleted-entry");
    await prisma.activityEntry.update({
      where: { id: "entry-deleted-entry" },
      data: { deletedAt: now },
    });
    const sendsBefore = sendPush.mock.calls.length;
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
    expect(
      await prisma.notification.findUnique({ where: { id: notification.id } }),
    ).toBeNull();
  });

  it("removes a pending photo alert if its activity is deleted", async () => {
    const notification = await createRecord("deleted-activity");
    await prisma.activity.update({
      where: { id: activityId },
      data: { deletedAt: now },
    });
    const sendsBefore = sendPush.mock.calls.length;
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
    expect(
      await prisma.notification.findUnique({ where: { id: notification.id } }),
    ).toBeNull();
    await prisma.activity.update({
      where: { id: activityId },
      data: { deletedAt: null },
    });
  });

  it("removes a pending photo alert if its photo was removed", async () => {
    const notification = await createRecord("removed-photo");
    await prisma.activityEntry.update({
      where: { id: "entry-removed-photo" },
      data: { imageUrl: null, imageUrls: [] },
    });
    const sendsBefore = sendPush.mock.calls.length;
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
    expect(
      await prisma.notification.findUnique({ where: { id: notification.id } }),
    ).toBeNull();
  });

  it("removes a pending photo alert if its activity becomes private", async () => {
    const notification = await createRecord("private-plan");
    const plan = await prisma.plan.create({
      data: {
        userId: ownerId,
        goal: "Private running",
        visibility: "PRIVATE",
        activities: { connect: { id: activityId } },
      },
    });
    const sendsBefore = sendPush.mock.calls.length;
    expect(await processPhotoNotification(notification.id, now)).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
    expect(
      await prisma.notification.findUnique({ where: { id: notification.id } }),
    ).toBeNull();
    await prisma.plan.delete({ where: { id: plan.id } });
  });

  it("makes an abandoned final claim visible without trying a fourth push", async () => {
    const notification = await createRecord("exhausted", {
      deliveryAttempts: 3,
      deliveryClaimedAt: new Date("2026-09-23T11:54:59Z"),
    });
    const sendsBefore = sendPush.mock.calls.length;
    await retryPendingPhotoNotifications(now);
    const saved = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(saved.status).toBe("PROCESSED");
    expect(saved.sentAt).toBeNull();
    expect(sendPush).toHaveBeenCalledTimes(sendsBefore);
  });
});
