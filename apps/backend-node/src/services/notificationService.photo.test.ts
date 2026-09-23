import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  userFindUnique: vi.fn(),
  apnsSend: vi.fn(),
  webSend: vi.fn(),
}));

vi.mock("web-push", () => ({
  setVapidDetails: vi.fn(),
  sendNotification: mocks.webSend,
}));

vi.mock("../utils/prisma", () => ({
  prisma: {
    notification: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      count: mocks.count,
    },
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock("./apnsService", () => ({
  apnsService: {
    isConfigured: () => true,
    sendPushNotification: mocks.apnsSend,
  },
}));
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { notificationService } from "./notificationService";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ENVIRONMENT = "production";
  mocks.findUnique.mockResolvedValue({
    id: "photo-notification",
    status: "PENDING",
    message: "Photo added",
    type: "INFO",
    title: null,
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
  mocks.userFindUnique.mockResolvedValue({
    id: "friend",
    isIosNotificationsEnabled: true,
    iosDeviceToken: "ios-token",
    isPwaNotificationsEnabled: false,
    pwaSubscriptionEndpoint: null,
    pwaSubscriptionKey: null,
    pwaSubscriptionAuthToken: null,
  });
  mocks.count.mockResolvedValue(1);
  mocks.apnsSend.mockResolvedValue(undefined);
  mocks.webSend.mockResolvedValue({ statusCode: 201 });
  mocks.update.mockResolvedValue({ message: "Photo added", type: "INFO" });
});

afterEach(() => {
  delete process.env.ENVIRONMENT;
});

it("delivers a photo alert to an iOS-only recipient and records send time", async () => {
  await notificationService.processNotification("photo-notification");
  expect(mocks.apnsSend).toHaveBeenCalledWith(
    expect.objectContaining({
      deviceToken: "ios-token",
      body: "photo added",
    }),
  );
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "photo-notification" },
      data: { sentAt: expect.any(Date) },
    }),
  );
});

it("does not deliver when the recipient disabled native push", async () => {
  const notification = await mocks.findUnique();
  mocks.findUnique.mockResolvedValue({
    ...notification,
    user: { ...notification.user, isIosNotificationsEnabled: false },
  });
  await notificationService.processNotification("photo-notification");
  expect(mocks.apnsSend).not.toHaveBeenCalled();
});

it("retains web push delivery for PWA-only recipients", async () => {
  const notification = await mocks.findUnique();
  mocks.findUnique.mockResolvedValue({
    ...notification,
    user: {
      ...notification.user,
      isIosNotificationsEnabled: false,
      iosDeviceToken: null,
      isPwaNotificationsEnabled: true,
      pwaSubscriptionEndpoint: "https://push.example.test/subscription",
    },
  });
  mocks.userFindUnique.mockResolvedValue({
    id: "friend",
    isIosNotificationsEnabled: false,
    iosDeviceToken: null,
    isPwaNotificationsEnabled: true,
    pwaSubscriptionEndpoint: "https://push.example.test/subscription",
    pwaSubscriptionKey: "p256dh",
    pwaSubscriptionAuthToken: "auth",
  });
  await notificationService.processNotification("photo-notification");
  expect(mocks.webSend).toHaveBeenCalledTimes(1);
  expect(mocks.apnsSend).not.toHaveBeenCalled();
});

it("retains inbox-only processing when pushNotify is false", async () => {
  await notificationService.processNotification("photo-notification", false);
  expect(mocks.apnsSend).not.toHaveBeenCalled();
  expect(mocks.webSend).not.toHaveBeenCalled();
});
