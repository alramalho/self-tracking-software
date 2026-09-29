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
import { mergeFormingCircles } from "../services/circles/jobs";
import { onEntryLogged } from "../services/circles/service";
import { circlesRouter } from "./circles";
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

const prefs = { wantsPace: true, wantsNearby: false, wantsAge: false };
let circleId: string;

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
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.circle.deleteMany({ where: { members: { some: { userId: { in: names.map(id) } } } } });
    await prisma.userBlock.deleteMany({ where: { blockerId: { in: names.map(id) } } });
    await prisma.notification.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.activityEntry.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.plan.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.activity.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.user.deleteMany({ where: { id: { in: names.map(id) } } });
  });

  it("offers to start a circle when nothing fits, and the starter owns it", async () => {
    const match = await call("alice", "POST", "/circles/match", { planId: plan.alice, ...prefs });
    expect(match.body).toEqual({ state: "none", similarPeople: 0 });
    const started = await call("alice", "POST", "/circles", { planId: plan.alice, ...prefs });
    expect(started.status).toBe(200);
    circleId = started.body.id;
    const circle = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(circle).toMatchObject({ status: "FORMING", openToMatching: true, name: "Run a 10K under 50 minutes" });
    expect(circle.members[0]).toMatchObject({ userId: id("alice"), role: "OWNER" });
  });

  it("matches a similar goal and joins straight away, with no approval step", async () => {
    const match = await call("bob", "POST", "/circles/match", { planId: plan.bob, ...prefs });
    expect(match.body.state).toBe("found");
    expect(match.body.circle).toMatchObject({ id: circleId, memberCount: 1, paceLabel: "4 a week" });
    expect(match.body.circle.reasons).toEqual(expect.arrayContaining(["goal", "pace", "timezone"]));
    fixture.notify.mockClear();
    const joined = await call("bob", "POST", `/circles/${circleId}/join`, { planId: plan.bob, ...prefs });
    expect(joined.body).toEqual({ id: circleId, status: "FORMING" });
    expect(fixture.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: id("alice"), type: "CIRCLE", title: "Bob joined", relatedData: { url: `/circle/${circleId}`, circleId } }),
    );
  });

  it("allows one circle per plan", async () => {
    const again = await call("bob", "POST", "/circles", { planId: plan.bob, ...prefs });
    expect(again).toMatchObject({ status: 400, body: { error: "This plan is already in a circle" } });
  });

  it("becomes active at three people and tells everyone", async () => {
    fixture.notify.mockClear();
    const joined = await call("carol", "POST", `/circles/${circleId}/join`, { planId: plan.carol, ...prefs });
    expect(joined.body.status).toBe("ACTIVE");
    const told = fixture.notify.mock.calls.map(([n]) => n.userId).sort();
    expect(told).toEqual([id("alice"), id("bob"), id("carol")].sort());
    expect(fixture.notify.mock.calls[0][0].title).toBe("Your circle is ready");
  });

  it("keeps blocked people out of each other's circles", async () => {
    await prisma.userBlock.create({ data: { blockerId: id("alice"), blockedId: id("dave") } });
    const match = await call("dave", "POST", "/circles/match", { planId: plan.dave, ...prefs });
    expect(match.body.state).toBe("none");
    const join = await call("dave", "POST", `/circles/${circleId}/join`, { planId: plan.dave, ...prefs });
    expect(join).toMatchObject({ status: 400, body: { error: "This circle isn't available" } });
  });

  it("shows the week board, with a mid-week joiner never counted as behind", async () => {
    await prisma.circleMember.update({
      where: { circleId_userId: { circleId, userId: id("alice") } },
      data: { joinedAt: new Date(Date.now() - 30 * 86400000) },
    });
    const board = await call("alice", "GET", `/circles/${circleId}`);
    expect(board.status).toBe(200);
    expect(board.body.members).toHaveLength(3);
    const byName = Object.fromEntries(board.body.members.map((m: any) => [m.user.name.split(" ")[0], m]));
    expect(byName.Alice.week).toMatchObject({ target: 4, done: 0, toGo: 4, behind: true, isNew: false });
    expect(byName.Carol.week).toMatchObject({ isNew: true, behind: false });
    expect(board.body.me).toMatchObject({ role: "OWNER", planId: plan.alice, hasIntro: false });
    const outsider = await call("erin", "GET", `/circles/${circleId}`);
    expect(outsider).toMatchObject({ status: 400, body: { error: "Join this circle to see its week" } });
  });

  it("puts circle-plan logs from after joining in members' timelines, labelled with the circle", async () => {
    const before = await log("alice", new Date(Date.now() - 40 * 86400000));
    await prisma.activityEntry.update({ where: { id: before.id }, data: { createdAt: new Date(Date.now() - 40 * 86400000) } });
    const after = await log("alice");
    const other = await prisma.activity.create({ data: { userId: id("alice"), title: "Yoga", emoji: "🧘", measure: "min" } });
    const unrelated = await prisma.activityEntry.create({ data: { userId: id("alice"), activityId: other.id, quantity: 20, datetime: new Date() } });
    const timeline = await call("bob", "GET", "/users/timeline");
    const entries = timeline.body.recommendedActivityEntries;
    const ids = entries.map((e: { id: string }) => e.id);
    expect(ids).toContain(after.id);
    expect(ids).not.toContain(before.id);
    expect(ids).not.toContain(unrelated.id);
    expect(entries.find((e: { id: string }) => e.id === after.id).circle).toMatchObject({ id: circleId, emoji: "🏃" });
  });

  it("treats a member's first log after joining as their intro and tells the others once", async () => {
    fixture.notify.mockClear();
    const first = await log("bob");
    await onEntryLogged(first);
    expect(fixture.notify.mock.calls.map(([n]) => n.title)).toEqual(["Bob said hi", "Bob said hi"]);
    fixture.notify.mockClear();
    await onEntryLogged(await log("bob"));
    expect(fixture.notify).not.toHaveBeenCalled();
    const feed = await call("carol", "GET", `/circles/${circleId}/feed`);
    expect(feed.body.introIds).toContain(first.id);
  });

  it("lets members nudge once a day and says what's left", async () => {
    fixture.notify.mockClear();
    const nudged = await call("alice", "POST", `/circles/${circleId}/nudges`, { toUserId: id("carol") });
    expect(nudged.status).toBe(204);
    expect(fixture.notify.mock.calls[0][0]).toMatchObject({
      userId: id("carol"),
      title: "Alice nudged you",
      message: "4 sessions left for your week in 🏃 Run a 10K under 50 minutes. You have 3 days.",
    });
    const again = await call("alice", "POST", `/circles/${circleId}/nudges`, { toUserId: id("carol") });
    expect(again).toMatchObject({ status: 400, body: { error: "You already nudged them today" } });
    const board = await call("alice", "GET", `/circles/${circleId}`);
    expect(board.body.members.find((m: any) => m.user.id === id("carol")).nudgedToday).toBe(true);
  });

  it("finds circles by goal in search, and lists the viewer's own circles", async () => {
    const found = await call("erin", "GET", "/circles/search?q=10K");
    expect(found.body.map((c: { id: string }) => c.id)).toContain(circleId);
    const mine = await call("bob", "GET", "/circles/mine");
    expect(mine.body).toEqual([
      expect.objectContaining({ id: circleId, planId: plan.bob, memberCount: 3, status: "ACTIVE" }),
    ]);
  });

  it("hands ownership on and goes back to forming when people leave", async () => {
    expect((await call("carol", "DELETE", `/circles/${circleId}/membership`)).status).toBe(204);
    expect((await call("alice", "DELETE", `/circles/${circleId}/membership`)).status).toBe(204);
    const circle = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(circle.status).toBe("FORMING");
    expect(circle.members).toEqual([expect.objectContaining({ userId: id("bob"), role: "OWNER" })]);
  });

  it("merges two forming circles whose people fit each other", async () => {
    const f = await call("frank", "POST", "/circles", { planId: plan.frank, ...prefs });
    const g = await call("gina", "POST", "/circles", { planId: plan.gina, ...prefs });
    // Bob's circle is the oldest forming one, so the newer two merge into it.
    await mergeFormingCircles();
    const bobs = await prisma.circle.findUniqueOrThrow({ where: { id: circleId }, include: { members: true } });
    expect(bobs.members.map((m) => m.userId).sort()).toEqual([id("bob"), id("frank"), id("gina")].sort());
    expect(bobs.status).toBe("ACTIVE");
    expect(await prisma.circle.count({ where: { id: { in: [f.body.id, g.body.id] } } })).toBe(0);
  });
});
