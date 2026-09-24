import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/utils/prisma";
import { encryptGarminSecret } from "./oauth";
import { ingestGarminWebhook } from "./service";

// Fail closed: synthetic users in the isolated local database only.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (database.hostname !== "127.0.0.1" || database.port !== "55432")
  throw new Error("Garmin webhook tests require the isolated local database on port 55432.");

const KEY = "test-encryption-key";
const prefix = `garmin-webhook-test-${randomUUID()}`;
let userId: string;
let garminUserId: string;

beforeAll(() => {
  vi.stubEnv("GARMIN_CONSUMER_KEY", "client-id");
  vi.stubEnv("GARMIN_CONSUMER_SECRET", "client-secret");
  vi.stubEnv("GARMIN_TOKEN_ENCRYPTION_KEY", KEY);
  vi.stubEnv("GARMIN_OAUTH_VERSION", "2");
});

beforeEach(async () => {
  userId = `${prefix}-${randomUUID()}`;
  garminUserId = `g-${randomUUID()}`;
  await prisma.user.create({
    data: { id: userId, email: `${randomUUID()}@example.invalid`, timezone: "UTC" },
  });
  // An OAuth2 connection: notifications identify it by Garmin user ID only.
  await prisma.garminIntegration.create({
    data: {
      userId,
      garminUserId,
      oauthVersion: 2,
      accessTokenEncrypted: encryptGarminSecret("access", KEY),
      refreshTokenEncrypted: encryptGarminSecret("refresh", KEY),
      accessTokenExpiresAt: new Date(Date.now() + 86_400_000),
      permissions: ["ACTIVITY_EXPORT"],
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});

describe("Garmin webhook (push, OAuth2 user)", () => {
  it("stores a pushed workout for the user identified by Garmin user ID", async () => {
    const result = await ingestGarminWebhook({
      activities: [
        {
          userId: garminUserId,
          summaryId: "activity-summary-1",
          activityId: "activity-1",
          startTimeInSeconds: 1_758_070_800,
          durationInSeconds: 1_800,
          activityType: "RUNNING",
          distanceInMeters: 5_000,
        },
      ],
    });
    expect(result.workouts).toBe(1);
    const workouts = await prisma.healthWorkout.findMany({ where: { userId } });
    expect(workouts).toHaveLength(1);
    expect(workouts[0].distanceMeters).toBe(5_000);
    const integration = await prisma.garminIntegration.findUniqueOrThrow({ where: { userId } });
    expect(integration.lastSyncCompletedAt).not.toBeNull();
  });

  it("applies a permission change and a deregistration", async () => {
    await ingestGarminWebhook({
      userPermissionsChange: [
        { userId: garminUserId, permissions: ["ACTIVITY_EXPORT", "HEALTH_EXPORT"] },
      ],
    });
    expect(
      (await prisma.garminIntegration.findUniqueOrThrow({ where: { userId } })).permissions,
    ).toEqual(["ACTIVITY_EXPORT", "HEALTH_EXPORT"]);

    await ingestGarminWebhook({ deregistrations: [{ userId: garminUserId }] });
    expect(
      (await prisma.garminIntegration.findUniqueOrThrow({ where: { userId } })).disconnectedAt,
    ).not.toBeNull();
  });

  it("ignores notifications for unknown Garmin users", async () => {
    const result = await ingestGarminWebhook({
      activities: [{ userId: "someone-else", summaryId: "x", activityType: "RUNNING" }],
    });
    expect(result.processed).toBe(0);
  });
});
