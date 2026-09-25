import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Each request runs as the fixture user named in its x-test-user header.
const fixture = vi.hoisted(() => ({
  users: {} as Record<string, any>,
  sendEmail: vi.fn(async () => undefined),
  sendAlert: vi.fn(async () => undefined),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = fixture.users[req.headers["x-test-user"]];
    next();
  },
}));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: {},
}));
vi.mock("../services/notificationService", () => ({
  notificationService: { createAndProcessNotification: vi.fn() },
}));
vi.mock("../services/sesService", () => ({
  sesService: { sendEmail: fixture.sendEmail },
}));
vi.mock("../services/telegramService", () => ({
  TelegramService: class {
    sendAlert = fixture.sendAlert;
    sendMessage = vi.fn();
  },
}));
vi.mock("stripe", () => ({ default: class {} }));
vi.mock("../services/plansService", () => ({
  plansService: { getBatchPlanProgress: async () => [] },
}));

import { prisma } from "../utils/prisma";
import { activitiesRouter } from "./activities";
import { adminRouter } from "./admin";
import { chatsRouter } from "./chats";
import { moderationRouter } from "./moderation";
import { usersRouter } from "./users";

// Fail closed: these tests create and delete only synthetic users in the isolated local database.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
)
  throw new Error(
    "Moderation tests require the isolated local database on port 55432.",
  );

const prefix = `moderation-test-${randomUUID()}`;
const alice = `${prefix}-alice`;
const bob = `${prefix}-bob`;
const carol = `${prefix}-carol`;
const ids = [alice, bob, carol];
let server: Server;
let baseUrl: string;
let aliceEntry: string, bobEntry: string, carolEntry: string;
let bobComment: string, chatId: string;

async function call(
  as: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-test-user": as, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function entryFor(userId: string) {
  const activity = await prisma.activity.create({
    data: { userId, title: "Running", emoji: "🏃", measure: "km" },
  });
  const entry = await prisma.activityEntry.create({
    data: { userId, activityId: activity.id, quantity: 5, datetime: new Date() },
  });
  return entry.id;
}

const timelineEntryIds = async (as: string) =>
  (await call(as, "GET", "/users/timeline")).body.recommendedActivityEntries.map(
    (entry: { id: string }) => entry.id,
  );
const commentUserIds = async (as: string, entryId: string) =>
  (
    await call(as, "GET", `/activities/activity-entries/${entryId}/comments`)
  ).body.comments.map((comment: { userId: string }) => comment.userId);

describe("reporting and blocking", () => {
  beforeAll(async () => {
    process.env.ADMIN_EMAIL = "moderator@test.local";
    process.env.REPORT_BCC_EMAILS = "backup@test.local, second@test.local";
    process.env.ADMIN_API_KEY = "moderation-test-admin-key";
    for (const id of ids) {
      fixture.users[id] = await prisma.user.create({
        data: { id, email: `${id}@test.local`, username: id.slice(-5) + randomUUID().slice(0, 6) },
      });
    }
    await prisma.connection.createMany({
      data: [
        { fromId: alice, toId: bob, status: "ACCEPTED" },
        { fromId: alice, toId: carol, status: "ACCEPTED" },
        { fromId: bob, toId: carol, status: "ACCEPTED" },
      ],
    });
    aliceEntry = await entryFor(alice);
    bobEntry = await entryFor(bob);
    carolEntry = await entryFor(carol);
    bobComment = (
      await prisma.comment.create({
        data: { activityEntryId: aliceEntry, userId: bob, text: "nice run" },
      })
    ).id;
    await prisma.comment.create({
      data: { activityEntryId: carolEntry, userId: alice, text: "go carol" },
    });
    await prisma.comment.create({
      data: { activityEntryId: carolEntry, userId: bob, text: "go carol too" },
    });
    chatId = (
      await prisma.chat.create({
        data: {
          type: "DIRECT",
          participants: { create: [{ userId: alice }, { userId: bob }] },
          messages: { create: { role: "USER", senderId: bob, content: "hey alice" } },
        },
      })
    ).id;

    const app = express();
    app.use(express.json());
    app.use("/users", usersRouter);
    app.use("/activities", activitiesRouter);
    app.use("/chats", chatsRouter);
    app.use("/moderation", moderationRouter);
    app.use("/admin", adminRouter);
    server = await new Promise((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.chat.deleteMany({ where: { id: chatId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("files a report, notifies the moderator and refuses self-reports", async () => {
    const report = await call(alice, "POST", "/moderation/reports", {
      kind: "COMMENT",
      targetId: bobComment,
      reason: "HARASSMENT",
      note: "keeps doing this",
    });
    expect(report.status).toBe(200);
    const saved = await prisma.contentReport.findUniqueOrThrow({
      where: { id: report.body.id },
    });
    expect(saved).toMatchObject({
      reporterId: alice,
      targetUserId: bob,
      kind: "COMMENT",
      status: "OPEN",
      snapshot: { text: "nice run" },
    });
    expect(fixture.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["moderator@test.local"],
        bcc: ["backup@test.local", "second@test.local"],
      }),
    );
    expect(fixture.sendAlert).toHaveBeenCalled();

    const own = await call(alice, "POST", "/moderation/reports", {
      kind: "ACTIVITY_ENTRY",
      targetId: aliceEntry,
      reason: "SPAM",
    });
    expect(own.status).toBe(400);
    const invalid = await call(alice, "POST", "/moderation/reports", {
      kind: "USER",
      targetId: bob,
      reason: "NOT_A_REASON",
    });
    expect(invalid.status).toBe(400);
  });

  it("hides a blocked pair from each other's feed, comments and messages", async () => {
    expect(await timelineEntryIds(alice)).toContain(bobEntry);
    expect(await commentUserIds(alice, aliceEntry)).toContain(bob);

    expect((await call(alice, "POST", `/moderation/blocks/${bob}`)).status).toBe(200);
    expect(
      (await call(alice, "GET", "/moderation/blocks")).body.blocks.map(
        (b: { id: string }) => b.id,
      ),
    ).toEqual([bob]);

    // Feed: both directions.
    expect(await timelineEntryIds(alice)).not.toContain(bobEntry);
    expect(await timelineEntryIds(alice)).toContain(carolEntry);
    expect(await timelineEntryIds(bob)).not.toContain(aliceEntry);

    // Comments: each side stops seeing the other's, even on a third person's entry.
    expect(await commentUserIds(alice, aliceEntry)).not.toContain(bob);
    expect(await commentUserIds(bob, carolEntry)).toEqual([bob]);
    expect(await commentUserIds(alice, carolEntry)).toEqual([alice]);
    expect(
      (
        await call(bob, "POST", `/activities/activity-entries/${aliceEntry}/comments`, {
          text: "hello?",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(bob, "POST", `/activities/activity-entries/${aliceEntry}/modify-reactions`, {
          reactions: [{ emoji: "🔥", operation: "add" }],
        })
      ).status,
    ).toBe(403);

    // Messages: the chat disappears and neither side can send.
    const chats = (await call(alice, "GET", "/chats")).body.chats;
    expect(chats.map((chat: { id: string }) => chat.id)).not.toContain(chatId);
    expect((await call(alice, "GET", `/chats/${chatId}/messages`)).status).toBe(404);
    expect(
      (await call(bob, "POST", `/chats/${chatId}/messages`, { message: "hi" })).status,
    ).toBe(403);
    expect((await call(bob, "POST", "/chats/direct", { userId: alice })).status).toBe(404);

    // Profiles.
    expect(
      (await call(bob, "POST", "/users/get-user", { identifiers: [{ id: alice }] })).status,
    ).toBe(404);
  });

  it("unblocking restores visibility of comments", async () => {
    expect((await call(alice, "DELETE", `/moderation/blocks/${bob}`)).status).toBe(200);
    expect(await commentUserIds(alice, aliceEntry)).toContain(bob);
    expect(await commentUserIds(alice, carolEntry)).toEqual([alice, bob]);
  });

  it("lets the moderator remove reported content", async () => {
    const auth = { authorization: "Bearer moderation-test-admin-key" };
    const reportId = (
      await prisma.contentReport.findFirstOrThrow({
        where: { reporterId: alice, targetId: bobComment },
      })
    ).id;
    expect((await call(alice, "GET", "/admin/reports")).status).toBe(401);
    const open = await call(alice, "GET", "/admin/reports", undefined, auth);
    expect(open.body.reports.map((r: { id: string }) => r.id)).toContain(reportId);

    const resolved = await call(
      alice,
      "POST",
      `/admin/reports/${reportId}/resolve`,
      { action: "remove" },
      auth,
    );
    expect(resolved.status).toBe(200);
    expect(
      (await prisma.comment.findUniqueOrThrow({ where: { id: bobComment } })).deletedAt,
    ).not.toBeNull();
    expect(
      (await prisma.contentReport.findUniqueOrThrow({ where: { id: reportId } })).status,
    ).toBe("ACTIONED");
    expect(await commentUserIds(alice, aliceEntry)).not.toContain(bob);

    // A removed direct message disappears from the conversation.
    const message = await prisma.message.findFirstOrThrow({ where: { chatId } });
    const messageReport = await call(alice, "POST", "/moderation/reports", {
      kind: "MESSAGE",
      targetId: message.id,
      reason: "SPAM",
    });
    await call(alice, "POST", `/admin/reports/${messageReport.body.id}/resolve`, { action: "remove" }, auth);
    expect((await call(alice, "GET", `/chats/${chatId}/messages`)).body.messages).toEqual([]);
  });
});
