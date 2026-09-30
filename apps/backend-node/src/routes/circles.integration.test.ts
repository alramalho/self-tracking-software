import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Each request runs as the fixture user named in its x-test-user header.
const fixture = vi.hoisted(() => ({
  users: {} as Record<string, any>,
  notify: vi.fn(async (data: any) => ({ id: "n", ...data })),
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
  notificationService: { createAndProcessNotification: fixture.notify },
}));
vi.mock("stripe", () => ({ default: class {} }));
// Week maths has its own tests; here every plan has 4 planned days, 3 days left and
// counts this week's logs on the plan.
vi.mock("../services/plansService", async () => {
  const { prisma } = await import("../utils/prisma");
  return {
    plansService: {
      getPlanEmbedding: async () => null,
      getBatchPlanProgress: async () => [],
      getPlanProgress: async () => ({ weeks: [] }),
      getPlanWeekStats: async (plan: { id: string }) => {
        const done = await prisma.activityEntry.count({
          where: { deletedAt: null, activity: { plans: { some: { id: plan.id } } } },
        });
        return {
          numActiveDaysInTheWeek: 4,
          daysCompletedThisWeek: done,
          numLeftDaysInTheWeek: 3,
          numActiveDaysLeftInTheWeek: Math.max(0, 4 - done),
        };
      },
    },
  };
});

import { prisma } from "../utils/prisma";
import { circleCoachPosts } from "../services/circles/coach/service";
import { expirePending, mergeFormingCircles, proofNudges } from "../services/circles/jobs";
import { onEntryLogged } from "../services/circles/service";
import { circlesRouter } from "./circles";
import { chatsRouter } from "./chats";
import { usersRouter } from "./users";

// Fail closed: these tests create and delete only synthetic users in the isolated local database.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
)
  throw new Error("Circle tests require the isolated local database on port 55432.");

const prefix = `circles-test-${randomUUID()}`;
const names = ["alice", "bob", "carol", "dave", "erin", "frank", "gina"] as const;
type Name = (typeof names)[number];
const id = (name: Name) => `${prefix}-${name}`;
const plan: Record<string, string> = {};
const activity: Record<string, string> = {};
let server: Server;
let baseUrl: string;

async function call(as: Name, method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-test-user": id(as) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

// Every test plan gets the same goal embedding, so goals always match.
const embedding = `[${Array.from({ length: 1536 }, (_, i) => (i % 7) + 1).join(",")}]`;

async function planFor(name: Name, goal = "Run a 10K under 50 minutes") {
  const a = await prisma.activity.create({
    data: { userId: id(name), title: "Running", emoji: "🏃", measure: "km" },
  });
  const p = await prisma.plan.create({
    data: {
      userId: id(name),
      goal,
      emoji: "🏃",
      finishingDate: new Date(Date.now() + 90 * 86400000),
      outlineType: "TIMES_PER_WEEK",
      timesPerWeek: 4,
      visibility: "PRIVATE",
      activities: { connect: { id: a.id } },
    },
  });
  await prisma.$executeRawUnsafe(`UPDATE "public"."plans" SET "embedding" = '${embedding}'::vector WHERE "id" = $1`, p.id);
  plan[name] = p.id;
  activity[name] = a.id;
}

const log = (name: Name, when = new Date()) =>
  prisma.activityEntry.create({
    data: { userId: id(name), activityId: activity[name], quantity: 5, datetime: when },
  });

// A log with a photo is a member's proof. The preview is cached so no image is fetched.
async function photoLog(name: Name) {
  const entry = await prisma.activityEntry.create({
    data: {
      userId: id(name),
      activityId: activity[name],
      quantity: 5,
      datetime: new Date(),
      imageUrls: ["https://example.test/run.jpg"],
      imagePreview: "data:image/jpeg;base64,AA==",
    },
  });
  await onEntryLogged(entry);
  return entry;
}

const events = (name: Name) =>
  prisma.circleEvent.findMany({ where: { userId: id(name) }, orderBy: { createdAt: "asc" } }).then((rows) => rows.map((r) => r.kind));

const prefs = { wantsPace: true, wantsNearby: false, wantsAge: false };
let circleId: string;
let chatId: string;

describe("circles", () => {
  beforeAll(async () => {
    for (const name of names)
      fixture.users[id(name)] = await prisma.user.create({
        data: {
          id: id(name),
          email: `${id(name)}@test.local`,
          name: `${name[0].toUpperCase()}${name.slice(1)} Test`,
          username: `${name}${randomUUID().slice(0, 6)}`,
          timezone: "Europe/Lisbon",
          lastActiveAt: new Date(),
        },
      });
    for (const name of names) await planFor(name);
    const app = express();
    app.use(express.json());
    app.use("/circles", circlesRouter);
    app.use("/users", usersRouter);
    app.use("/chats", chatsRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.chat.deleteMany({ where: { type: "DIRECT", participants: { some: { userId: { in: names.map(id) } } } } });
    await prisma.circle.deleteMany({ where: { members: { some: { userId: { in: names.map(id) } } } } });
    await prisma.userBlock.deleteMany({ where: { blockerId: { in: names.map(id) } } });
    await prisma.notification.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.activityEntry.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.plan.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.activity.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.user.deleteMany({ where: { id: { in: names.map(id) } } });
  });

  it("offers to start a circle when nothing fits; the starter owns it but is pending", async () => {
    const match = await call("alice", "POST", "/circles/match", { planId: plan.alice, ...prefs });
    expect(match.body).toEqual({ state: "none", similarPeople: 0 });
    const started = await call("alice", "POST", "/circles", { planId: plan.alice, ...prefs });
    expect(started.status).toBe(200);
    circleId = started.body.id;
    const circle = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(circle).toMatchObject({ status: "FORMING", openToMatching: true, discoverable: true, name: "Run a 10K under 50 minutes" });
    expect(circle.members[0]).toMatchObject({ userId: id("alice"), role: "OWNER", provenAt: null });
    expect(await events("alice")).toEqual(["JOINED"]);
  });

  it("doesn't offer a circle until someone in it has posted a photo", async () => {
    const before = await call("bob", "POST", "/circles/match", { planId: plan.bob, ...prefs });
    expect(before.body.state).toBe("none");
    // A log without a photo is not proof.
    await onEntryLogged(await log("alice"));
    expect((await prisma.circleMember.findFirstOrThrow({ where: { userId: id("alice") } })).provenAt).toBeNull();
    await photoLog("alice");
    expect((await prisma.circleMember.findFirstOrThrow({ where: { userId: id("alice") } })).provenAt).not.toBeNull();
    expect(await events("alice")).toEqual(["JOINED", "PROVED"]);
  });

  it("matches a similar goal; joining is immediate but pending until the joiner's first photo", async () => {
    const match = await call("bob", "POST", "/circles/match", { planId: plan.bob, ...prefs });
    expect(match.body.state).toBe("found");
    expect(match.body.circle).toMatchObject({ id: circleId, memberCount: 1, paceLabel: "4 a week" });
    expect(match.body.circle.reasons).toEqual(expect.arrayContaining(["goal", "pace", "timezone"]));
    fixture.notify.mockClear();
    const joined = await call("bob", "POST", `/circles/${circleId}/join`, { planId: plan.bob, ...prefs });
    expect(joined.body).toEqual({ id: circleId, pending: true });
    // Nobody hears about a pending member.
    expect(fixture.notify).not.toHaveBeenCalled();
    const aliceBoard = await call("alice", "GET", `/circles/${circleId}`);
    expect(aliceBoard.body.members.map((m: any) => m.user.id)).toEqual([id("alice")]);
    const bobBoard = await call("bob", "GET", `/circles/${circleId}`);
    expect(bobBoard.body.me.pending).toBe(true);
    // Two proven people are enough for the weekly board.
    await photoLog("bob");
    expect((await prisma.circle.findUniqueOrThrow({ where: { id: circleId } })).status).toBe("ACTIVE");
    expect(fixture.notify.mock.calls.map(([n]) => n.userId).sort()).toEqual([id("alice"), id("bob")].sort());
    expect(fixture.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: id("alice"),
        type: "CIRCLE",
        title: "Your circle is ready",
        message: "🏃 Run a 10K under 50 minutes: you and 1 other with a similar goal. The board starts now.",
        relatedData: { url: `/circle/${circleId}`, circleId },
      }),
    );
  });

  it("allows one circle per plan", async () => {
    const again = await call("bob", "POST", "/circles", { planId: plan.bob, ...prefs });
    expect(again).toMatchObject({ status: 400, body: { error: "This plan is already in a circle" } });
  });

  it("tells the circle when someone new proves in", async () => {
    await call("carol", "POST", `/circles/${circleId}/join`, { planId: plan.carol, ...prefs });
    fixture.notify.mockClear();
    await photoLog("carol");
    const told = fixture.notify.mock.calls.map(([n]) => n.userId).sort();
    expect(told).toEqual([id("alice"), id("bob")].sort());
    expect(fixture.notify.mock.calls[0][0].title).toBe("Carol joined");
  });

  it("keeps blocked people out of each other's circles", async () => {
    await prisma.userBlock.create({ data: { blockerId: id("alice"), blockedId: id("dave") } });
    const match = await call("dave", "POST", "/circles/match", { planId: plan.dave, ...prefs });
    expect(match.body.state).toBe("none");
    const join = await call("dave", "POST", `/circles/${circleId}/join`, { planId: plan.dave, ...prefs });
    expect(join).toMatchObject({ status: 400, body: { error: "This circle isn't available" } });
  });

  it("shows the week board; a mid-week joiner is never behind and pending people stay out of sight", async () => {
    await prisma.circleMember.update({
      where: { circleId_userId: { circleId, userId: id("alice") } },
      data: { joinedAt: new Date(Date.now() - 30 * 86400000) },
    });
    await call("erin", "POST", `/circles/${circleId}/join`, { planId: plan.erin, ...prefs });
    const board = await call("alice", "GET", `/circles/${circleId}`);
    expect(board.status).toBe(200);
    expect(board.body.members).toHaveLength(3);
    const byName = Object.fromEntries(board.body.members.map((m: any) => [m.user.name.split(" ")[0], m]));
    expect(byName.Alice.week).toMatchObject({ target: 4, isNew: false });
    expect(byName.Carol.week).toMatchObject({ isNew: true, behind: false });
    expect(board.body.me).toMatchObject({ role: "OWNER", planId: plan.alice, hasIntro: true, pending: false });
    const erin = await call("erin", "GET", `/circles/${circleId}`);
    expect(erin.body.me.pending).toBe(true);
    expect(erin.body.members.map((m: any) => m.user.id)).toContain(id("erin"));
    const outsider = await call("frank", "GET", `/circles/${circleId}`);
    expect(outsider).toMatchObject({ status: 400, body: { error: "Join this circle to see its week" } });
  });

  it("puts proven members' circle-plan logs from after joining in timelines, labelled with the circle", async () => {
    const before = await log("alice", new Date(Date.now() - 40 * 86400000));
    await prisma.activityEntry.update({ where: { id: before.id }, data: { createdAt: new Date(Date.now() - 40 * 86400000) } });
    const after = await log("alice");
    const other = await prisma.activity.create({ data: { userId: id("alice"), title: "Yoga", emoji: "🧘", measure: "min" } });
    const unrelated = await prisma.activityEntry.create({ data: { userId: id("alice"), activityId: other.id, quantity: 20, datetime: new Date() } });
    const pendingLog = await log("erin");
    const timeline = await call("bob", "GET", "/users/timeline");
    const entries = timeline.body.recommendedActivityEntries;
    const ids = entries.map((e: { id: string }) => e.id);
    expect(ids).toContain(after.id);
    expect(ids).not.toContain(before.id);
    expect(ids).not.toContain(unrelated.id);
    expect(ids).not.toContain(pendingLog.id);
    expect(entries.find((e: { id: string }) => e.id === after.id).circle).toMatchObject({ id: circleId, emoji: "🏃" });
  });

  it("opens private encouragement for proven members without sending a nudge", async () => {
    fixture.notify.mockClear();
    const opened = await call("alice", "POST", "/chats/direct", { userId: id("bob"), circleId });
    expect(opened.status).toBe(200);
    expect(opened.body.chat.type).toBe("DIRECT");
    expect(fixture.notify).not.toHaveBeenCalled();
    const again = await call("alice", "POST", "/chats/direct", { userId: id("bob"), circleId });
    expect(again.body.chat.id).toBe(opened.body.chat.id);
    const text = "You've already made a start. Want to run together tomorrow?";
    const sent = await call("alice", "POST", `/chats/${opened.body.chat.id}/messages`, { message: text });
    expect(sent.status).toBe(200);
    expect(sent.body.message.content).toBe(text);
    expect(await prisma.circleNudge.count({ where: { circleId } })).toBe(0);
    expect(fixture.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: id("bob"), title: "New message from Alice Test", message: expect.any(String) }));
  });

  it("keeps encouragement private to proven, unblocked circle peers", async () => {
    const pending = await call("alice", "POST", "/chats/direct", { userId: id("erin"), circleId });
    expect(pending.status).toBe(403);
    expect((await call("erin", "POST", "/chats/direct", { userId: id("alice"), circleId })).status).toBe(403);
    expect((await call("frank", "POST", "/chats/direct", { userId: id("alice"), circleId })).status).toBe(403);
    expect((await call("alice", "POST", "/chats/direct", { userId: id("dave"), circleId })).status).toBe(404);
    expect((await call("alice", "POST", "/chats/direct", { userId: id("alice"), circleId })).status).toBe(400);
    // Shared membership doesn't silently change the ordinary friend-only route.
    expect((await call("alice", "POST", "/chats/direct", { userId: id("carol") })).status).toBe(403);
  });

  it("records a skipped photo, nudges once the next day, and frees the spot after a week", async () => {
    expect((await call("erin", "POST", `/circles/${circleId}/proof-skipped`)).status).toBe(204);
    const erin = { circleId_userId: { circleId, userId: id("erin") } };
    await prisma.circleMember.update({ where: erin, data: { joinedAt: new Date(Date.now() - 25 * 3600000) } });
    fixture.notify.mockClear();
    expect(await proofNudges()).toBeGreaterThanOrEqual(1);
    expect(fixture.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: id("erin"), title: "Helly · Your circle is waiting" }));
    fixture.notify.mockClear();
    await proofNudges();
    expect(fixture.notify).not.toHaveBeenCalledWith(expect.objectContaining({ userId: id("erin") }));
    await prisma.circleMember.update({ where: erin, data: { joinedAt: new Date(Date.now() - 8 * 86400000) } });
    await expirePending();
    expect(await prisma.circleMember.findUnique({ where: erin })).toBeNull();
    expect(await events("erin")).toEqual(["JOINED", "PROOF_SKIPPED", "PROOF_NUDGED", "EXPIRED"]);
  });

  it("lets members nudge once a day, never someone still pending, and says what's left", async () => {
    fixture.notify.mockClear();
    const nudged = await call("alice", "POST", `/circles/${circleId}/nudges`, { toUserId: id("carol") });
    expect(nudged.status).toBe(204);
    expect(fixture.notify.mock.calls[0][0]).toMatchObject({ userId: id("carol"), title: "Alice nudged you" });
    expect(fixture.notify.mock.calls[0][0].message).toMatch(/sessions? left for your week in 🏃 Run a 10K under 50 minutes\. You have 3 days\./);
    const again = await call("alice", "POST", `/circles/${circleId}/nudges`, { toUserId: id("carol") });
    expect(again).toMatchObject({ status: 400, body: { error: "You already nudged them today" } });
    const board = await call("alice", "GET", `/circles/${circleId}`);
    expect(board.body.members.find((m: any) => m.user.id === id("carol")).nudgedToday).toBe(true);
  });

  it("finds circles by goal in search, and lists the viewer's own circles", async () => {
    const found = await call("frank", "GET", "/circles/search?q=10K");
    expect(found.body.map((c: { id: string }) => c.id)).toContain(circleId);
    const mine = await call("bob", "GET", "/circles/mine");
    expect(mine.body).toEqual([
      expect.objectContaining({ id: circleId, planId: plan.bob, memberCount: 3, status: "ACTIVE", pending: false }),
    ]);
  });

  it("gives proven members one circle chat, titled after the circle", async () => {
    const opened = await call("alice", "POST", `/circles/${circleId}/chat`);
    expect(opened.status).toBe(200);
    const again = await call("bob", "POST", `/circles/${circleId}/chat`);
    expect(again.body.chatId).toBe(opened.body.chatId);
    chatId = opened.body.chatId;
    const chat = await prisma.chat.findUniqueOrThrow({ where: { id: chatId }, include: { participants: true } });
    expect(chat).toMatchObject({ type: "GROUP", circleId, title: "🏃 Run a 10K under 50 minutes" });
    expect(chat.participants.map((p) => p.userId).sort()).toEqual([id("alice"), id("bob"), id("carol")].sort());
    const outsider = await call("frank", "POST", `/circles/${circleId}/chat`);
    expect(outsider).toMatchObject({ status: 400, body: { error: "Join this circle to see its week" } });
  });

  it("has Helly call out who's behind in the circle chat on Thursday evening, once", async () => {
    await prisma.circleMember.update({
      where: { circleId_userId: { circleId, userId: id("bob") } },
      data: { joinedAt: new Date(Date.now() - 30 * 86400000) },
    });
    // Thursday 18:30 in Lisbon, the owner's time zone.
    const thursdayEvening = new Date("2026-10-01T17:30:00Z");
    fixture.notify.mockClear();
    expect(await circleCoachPosts(thursdayEvening)).toBe(1);
    const post = await prisma.message.findFirstOrThrow({ where: { chatId, role: "COACH" } });
    expect(post.content).toContain("Halfway check 👀");
    expect(post.content).toContain("Bob needs 3 more in 3 days");
    expect(post.content).toContain("Who's joining Bob for a session?");
    expect(fixture.notify.mock.calls.map(([n]) => n.userId).sort()).toEqual([id("alice"), id("bob"), id("carol")].sort());
    expect(fixture.notify.mock.calls[0][0]).toMatchObject({
      title: "Helly · 🏃 Run a 10K under 50 minutes",
      relatedData: { url: `/chat/${chatId}`, chatId, circleId },
    });
    const messages = await call("carol", "GET", `/chats/${chatId}/messages`);
    expect(messages.body.messages.find((m: any) => m.role === "COACH").senderName).toBe("Helly");
    // The hourly job runs again within the same hour: nothing new.
    expect(await circleCoachPosts(thursdayEvening)).toBe(0);
    expect(await prisma.message.count({ where: { chatId, role: "COACH" } })).toBe(1);
  });

  it("hands ownership on and goes back to forming when people leave", async () => {
    expect((await call("carol", "DELETE", `/circles/${circleId}/membership`)).status).toBe(204);
    expect((await call("alice", "DELETE", `/circles/${circleId}/membership`)).status).toBe(204);
    const circle = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(circle.status).toBe("FORMING");
    expect(circle.members).toEqual([expect.objectContaining({ userId: id("bob"), role: "OWNER" })]);
    // People who leave lose the circle chat too.
    const participants = await prisma.chatParticipant.findMany({ where: { chatId } });
    expect(participants.map((p) => p.userId)).toEqual([id("bob")]);
    expect(await events("carol")).toContain("LEFT");
  });

  it("merges forming circles whose people fit, counting only proven people toward the board", async () => {
    const f = await call("frank", "POST", "/circles", { planId: plan.frank, ...prefs });
    const g = await call("gina", "POST", "/circles", { planId: plan.gina, ...prefs });
    await photoLog("frank");
    await photoLog("gina");
    await mergeFormingCircles();
    const bobs = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(bobs.members.map((m) => m.userId).sort()).toEqual([id("bob"), id("frank"), id("gina")].sort());
    expect(bobs.status).toBe("ACTIVE");
    expect(await prisma.circle.count({ where: { id: { in: [f.body.id, g.body.id] } } })).toBe(0);
  });
});
