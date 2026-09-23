import express from "express";
import { TZDate } from "@date-fns/tz";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  ownerId: "photo-route-integration-owner",
  friendId: "photo-route-integration-friend",
  activityId: "photo-route-integration-activity",
  upload: vi.fn(),
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = {
      id: fixture.ownerId,
      username: "alex",
      name: "Alex",
      picture: null,
      timezone: "Europe/Lisbon",
      planType: "FREE",
    };
    next();
  },
}));
vi.mock("../s3Service", () => ({
  s3Service: {
    upload: fixture.upload,
    getPublicUrl: (path: string) => `https://photo.example.test${path}`,
  },
}));
vi.mock("../plansService", () => ({
  plansService: { recalculateCurrentWeekState: vi.fn() },
}));

import { activitiesRouter } from "../../routes/activities";
import { prisma } from "../../utils/prisma";
import { notificationService } from "../notificationService";
import { processPhotoNotificationOutbox, retryPhotoNotificationOutbox } from "./outbox";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55433" ||
  database.pathname !== "/tracking_photo_test"
) {
  throw new Error(
    "Photo route tests require the isolated local database on port 55433.",
  );
}

let server: Server;
let baseUrl: string;
let sendPush: ReturnType<typeof vi.spyOn>;

const photoForm = (fields: Record<string, string> = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append(
    "photos",
    new Blob(["fixture image bytes"], { type: "image/jpeg" }),
    "proof.jpg",
  );
  return form;
};

async function waitForPhotoNotification(entryId: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const notification = await prisma.notification.findUnique({
      where: { dedupeKey: `ACTIVITY_PHOTO:${entryId}:${fixture.friendId}` },
    });
    if (notification?.status === "PROCESSED") return notification;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Photo notification for ${entryId} was not processed`);
}

async function waitForFailedOutboxAttempt(entryId: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const work = await prisma.activityPhotoNotificationOutbox.findFirst({
      where: { entryId },
      orderBy: { createdAt: "desc" },
    });
    if (work?.attempts === 1 && work.nextAttemptAt) return work;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Photo outbox for ${entryId} was not retained for retry`);
}

async function createEntry(suffix: string, datetime: Date) {
  return prisma.activityEntry.create({
    data: {
      id: `photo-route-entry-${suffix}`,
      userId: fixture.ownerId,
      activityId: fixture.activityId,
      quantity: 2,
      datetime,
      timezone: "Europe/Lisbon",
    },
  });
}

describe("real photo routes queue recipient notifications", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [fixture.ownerId, fixture.friendId] } },
    });
    await prisma.user.create({
      data: {
        id: fixture.ownerId,
        username: "alex",
        email: `${fixture.ownerId}@test.local`,
        timezone: "Europe/Lisbon",
      },
    });
    await prisma.user.create({
      data: {
        id: fixture.friendId,
        username: "friend",
        email: `${fixture.friendId}@test.local`,
        isIosNotificationsEnabled: true,
        iosDeviceToken: "stubbed-ios-token",
      },
    });
    await prisma.activity.create({
      data: {
        id: fixture.activityId,
        userId: fixture.ownerId,
        title: "Running",
        emoji: "🏃",
        measure: "km",
      },
    });
    await prisma.connection.create({
      data: {
        fromId: fixture.ownerId,
        toId: fixture.friendId,
        status: "ACCEPTED",
      },
    });
    fixture.upload.mockResolvedValue(undefined);
    sendPush = vi
      .spyOn(notificationService, "sendPushNotification")
      .mockResolvedValue({
        platform: "ios",
        message: "stubbed",
      });
    const app = express();
    app.use("/activities", activitiesRouter);
    server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    sendPush?.mockRestore();
    await prisma.user.deleteMany({
      where: { id: { in: [fixture.ownerId, fixture.friendId] } },
    });
    await prisma.$disconnect();
  });

  it("POST with a photo creates the inbox record and payload once", async () => {
    const response = await fetch(`${baseUrl}/activities/log-activity`, {
      method: "POST",
      body: photoForm({
        activityId: fixture.activityId,
        iso_date_string: new Date().toISOString(),
        quantity: "2",
        timezone: "Europe/Lisbon",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    const notification = await waitForPhotoNotification(body.entry.id);
    expect(notification.userId).toBe(fixture.friendId);
    expect(notification.relatedId).toBe(body.entry.id);
    expect(notification.relatedData).toMatchObject({
      activityEntryId: body.entry.id,
      userUsername: "alex",
      category: "ACTIVITY_PHOTO",
    });
    expect(notification.sentAt).not.toBeNull();

    const repeated = await fetch(
      `${baseUrl}/activities/activity-entries/${body.entry.id}/photo`,
      {
        method: "PUT",
        body: photoForm(),
      },
    );
    expect(repeated.status).toBe(200);
    expect(
      await prisma.notification.count({ where: { relatedId: body.entry.id } }),
    ).toBe(1);
    expect(
      await prisma.activityPhotoNotificationOutbox.count({
        where: { entryId: body.entry.id },
      }),
    ).toBe(2);
  });

  it("PUT after a photo-free log creates the same photo alert", async () => {
    const entry = await createEntry("late-photo", new Date());
    const response = await fetch(
      `${baseUrl}/activities/activity-entries/${entry.id}/photo`,
      {
        method: "PUT",
        body: photoForm(),
      },
    );
    expect(response.status).toBe(200);
    const notification = await waitForPhotoNotification(entry.id);
    expect(notification.message).toContain("added a photo");
  });

  it("does not queue an upload for an activity completed more than 12 hours ago", async () => {
    const entry = await createEntry(
      "old-activity",
      new Date(Date.now() - 13 * 60 * 60 * 1000),
    );
    const response = await fetch(
      `${baseUrl}/activities/activity-entries/${entry.id}/photo`,
      {
        method: "PUT",
        body: photoForm(),
      },
    );
    expect(response.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      await prisma.notification.count({ where: { relatedId: entry.id } }),
    ).toBe(0);
  });

  it("uses the finish day for a live activity that started yesterday", async () => {
    const localNow = new TZDate(new Date(), "Europe/Lisbon");
    const yesterdayAt2330 = new TZDate(
      localNow.getFullYear(),
      localNow.getMonth(),
      localNow.getDate() - 1,
      23,
      30,
      0,
      "Europe/Lisbon",
    );
    const entry = await prisma.activityEntry.create({
      data: {
        id: "photo-route-entry-live-midnight",
        userId: fixture.ownerId,
        activityId: fixture.activityId,
        quantity: 1,
        datetime: new Date(yesterdayAt2330.getTime()),
        startedAt: new Date(yesterdayAt2330.getTime()),
        endedAt: new Date(),
        isLiveTracked: true,
        timezone: "Europe/Lisbon",
      },
    });
    const response = await fetch(
      `${baseUrl}/activities/activity-entries/${entry.id}/photo`,
      {
        method: "PUT",
        body: photoForm(),
      },
    );
    expect(response.status).toBe(200);
    await waitForPhotoNotification(entry.id);
  });

  it("can notify after a failed initial photo upload is retried through PUT", async () => {
    fixture.upload.mockRejectedValueOnce(
      new Error("temporary storage failure"),
    );
    const response = await fetch(`${baseUrl}/activities/log-activity`, {
      method: "POST",
      body: photoForm({
        activityId: fixture.activityId,
        iso_date_string: new Date().toISOString(),
        quantity: "1",
        timezone: "Europe/Lisbon",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entry.imageUrls).toEqual([]);
    expect(
      await prisma.notification.count({ where: { relatedId: body.entry.id } }),
    ).toBe(0);
    const retry = await fetch(
      `${baseUrl}/activities/activity-entries/${body.entry.id}/photo`,
      {
        method: "PUT",
        body: photoForm(),
      },
    );
    expect(retry.status).toBe(200);
    await waitForPhotoNotification(body.entry.id);
    expect(
      await prisma.notification.count({ where: { relatedId: body.entry.id } }),
    ).toBe(1);
  });

  it("recovers a POST alert when a saved log receipt is replayed after the hook was interrupted", async () => {
    const entry = await prisma.activityEntry.create({
      data: {
        id: "photo-route-entry-log-replay",
        userId: fixture.ownerId,
        activityId: fixture.activityId,
        quantity: 2,
        datetime: new Date(),
        timezone: "Europe/Lisbon",
        imageUrl: "https://photo.example.test/replayed-log.jpg",
        imageUrls: ["https://photo.example.test/replayed-log.jpg"],
      },
    });
    const clientRequestId = "0ac1d754-4db6-497d-a4fa-3de38da30011";
    await prisma.activityLogRequest.create({
      data: { userId: fixture.ownerId, requestId: clientRequestId, entryId: entry.id },
    });
    fixture.upload.mockClear();
    const replay = () => fetch(`${baseUrl}/activities/log-activity`, {
      method: "POST",
      body: photoForm({
        activityId: fixture.activityId,
        iso_date_string: entry.datetime.toISOString(),
        quantity: "2",
        timezone: "Europe/Lisbon",
        clientRequestId,
      }),
    });
    expect((await replay()).status).toBe(200);
    await waitForPhotoNotification(entry.id);
    expect((await replay()).status).toBe(200);
    expect(fixture.upload).not.toHaveBeenCalled();
    expect((await prisma.activityEntry.findUniqueOrThrow({ where: { id: entry.id } })).quantity).toBe(2);
    expect(await prisma.notification.count({ where: { relatedId: entry.id } })).toBe(1);
  });

  it("recovers a PUT alert when a saved photo receipt is replayed after the hook was interrupted", async () => {
    const entry = await prisma.activityEntry.create({
      data: {
        id: "photo-route-entry-put-replay",
        userId: fixture.ownerId,
        activityId: fixture.activityId,
        quantity: 1,
        datetime: new Date(),
        timezone: "Europe/Lisbon",
        imageUrl: "https://photo.example.test/replayed-put.jpg",
        imageUrls: ["https://photo.example.test/replayed-put.jpg"],
      },
    });
    const clientRequestId = "0ac1d754-4db6-497d-a4fa-3de38da30012";
    await prisma.activityPhotoRequest.create({
      data: { userId: fixture.ownerId, requestId: clientRequestId, entryId: entry.id },
    });
    fixture.upload.mockClear();
    const replay = () => fetch(
      `${baseUrl}/activities/activity-entries/${entry.id}/photo`,
      { method: "PUT", body: photoForm({ clientRequestId }) },
    );
    expect((await replay()).status).toBe(200);
    await waitForPhotoNotification(entry.id);
    expect((await replay()).status).toBe(200);
    expect(fixture.upload).not.toHaveBeenCalled();
    expect(await prisma.notification.count({ where: { relatedId: entry.id } })).toBe(1);
  });

  it("recovers a first POST photo alert after notification persistence fails", async () => {
    const originalCreate = notificationService.createNotification.bind(notificationService);
    const createSpy = vi.spyOn(notificationService, "createNotification")
      .mockRejectedValueOnce(new Error("temporary notification write failure"))
      .mockImplementation(originalCreate);
    try {
      const response = await fetch(`${baseUrl}/activities/log-activity`, {
        method: "POST",
        body: photoForm({
          activityId: fixture.activityId,
          iso_date_string: new Date().toISOString(),
          quantity: "1",
          timezone: "Europe/Lisbon",
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      const work = await waitForFailedOutboxAttempt(body.entry.id);
      expect(await prisma.notification.count({ where: { relatedId: body.entry.id } })).toBe(0);
      await retryPhotoNotificationOutbox(new Date(work.nextAttemptAt!.getTime() + 1));
      await waitForPhotoNotification(body.entry.id);
      expect((await prisma.activityPhotoNotificationOutbox.findFirstOrThrow({ where: { entryId: body.entry.id } })).processedAt).not.toBeNull();
    } finally {
      createSpy.mockRestore();
    }
  });

  it("recovers a first PUT photo alert after notification persistence fails", async () => {
    const entry = await createEntry("outbox-recovery", new Date());
    const originalCreate = notificationService.createNotification.bind(notificationService);
    const createSpy = vi.spyOn(notificationService, "createNotification")
      .mockRejectedValueOnce(new Error("temporary notification write failure"))
      .mockImplementation(originalCreate);
    try {
      const response = await fetch(
        `${baseUrl}/activities/activity-entries/${entry.id}/photo`,
        { method: "PUT", body: photoForm() },
      );
      expect(response.status).toBe(200);
      const work = await waitForFailedOutboxAttempt(entry.id);
      expect(await prisma.notification.count({ where: { relatedId: entry.id } })).toBe(0);
      await retryPhotoNotificationOutbox(new Date(work.nextAttemptAt!.getTime() + 1));
      await waitForPhotoNotification(entry.id);
      expect((await prisma.activityPhotoNotificationOutbox.findFirstOrThrow({ where: { entryId: entry.id } })).processedAt).not.toBeNull();
    } finally {
      createSpy.mockRestore();
    }
  });

  it("keeps an eligible photo's cutoff time when a later photo is too late", async () => {
    const completedAt = new Date("2026-09-23T09:00:00Z");
    const withinWindow = new Date("2026-09-23T20:59:00Z");
    const afterWindow = new Date("2026-09-23T21:01:00Z");
    const deliveryAt = new Date("2026-09-23T21:02:00Z");
    const entry = await prisma.activityEntry.create({
      data: {
        id: "photo-route-entry-cutoff-retry",
        userId: fixture.ownerId,
        activityId: fixture.activityId,
        quantity: 1,
        datetime: completedAt,
        timezone: "Europe/Lisbon",
        imageUrl: "https://photo.example.test/cutoff.jpg",
        imageUrls: ["https://photo.example.test/cutoff.jpg"],
        imageCreatedAt: afterWindow,
      },
    });
    const first = await prisma.activityPhotoNotificationOutbox.create({
      data: { entryId: entry.id, photoAddedAt: withinWindow },
    });
    const later = await prisma.activityPhotoNotificationOutbox.create({
      data: { entryId: entry.id, photoAddedAt: afterWindow },
    });
    expect(await processPhotoNotificationOutbox(later.id, deliveryAt)).toBe(true);
    expect(await prisma.notification.count({ where: { relatedId: entry.id } })).toBe(0);
    expect(await processPhotoNotificationOutbox(first.id, deliveryAt)).toBe(true);
    await waitForPhotoNotification(entry.id);
    expect(await prisma.activityPhotoNotificationOutbox.count({ where: { entryId: entry.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { relatedId: entry.id } })).toBe(1);
  });

  it("delivers a photo saved before local midnight after retrying the next day", async () => {
    const completedAt = new Date("2026-09-23T22:00:00Z");
    const photoAddedAt = new Date("2026-09-23T22:58:00Z");
    const deliveryAt = new Date("2026-09-23T23:02:00Z");
    const entry = await prisma.activityEntry.create({
      data: {
        id: "photo-route-entry-midnight-retry",
        userId: fixture.ownerId,
        activityId: fixture.activityId,
        quantity: 1,
        datetime: completedAt,
        timezone: "Europe/Lisbon",
        imageUrl: "https://photo.example.test/midnight.jpg",
        imageUrls: ["https://photo.example.test/midnight.jpg"],
        imageCreatedAt: photoAddedAt,
      },
    });
    const work = await prisma.activityPhotoNotificationOutbox.create({
      data: { entryId: entry.id, photoAddedAt },
    });
    expect(await processPhotoNotificationOutbox(work.id, deliveryAt)).toBe(true);
    await waitForPhotoNotification(entry.id);
  });
});
