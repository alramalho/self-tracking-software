import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";

// Fail closed: synthetic users in the isolated local database only.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (database.hostname !== "127.0.0.1" || database.port !== "55432")
  throw new Error("Activity merge tests require the isolated local database on port 55432.");

const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock("../../utils/aiSdk", () => ({ evaluate }));
vi.mock("../../services/telegramService", () => ({
  TelegramService: vi.fn(() => ({ sendAlert: vi.fn(), sendMessage: vi.fn() })),
}));
// Signed in as whoever the test says, without Clerk.
let current: any;
vi.mock("../../middleware/auth", () => ({
  requireAuth: [(req: any, _res: any, next: any) => ((req.user = current), next())],
}));

const prefix = `activity-merge-test-${randomUUID()}`;
let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  // The router's imports build AI clients at load time; every AI call here is mocked.
  process.env.AI_GATEWAY_API_KEY ||= "unused-in-tests";
  const { activitiesRouter } = await import("../activities");
  const app = express().use(express.json()).use("/activities", activitiesRouter);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});
beforeEach(async () => {
  vi.clearAllMocks();
  current = await prisma.user.create({
    data: {
      id: `${prefix}-${randomUUID()}`,
      email: `${randomUUID()}@example.invalid`,
      clerkId: `clerk_${randomUUID()}`,
    },
  });
});

const createActivity = (title: string, measure = "minutes", emoji = "🥾") =>
  prisma.activity.create({ data: { userId: current.id, title, measure, emoji } });
const log = (activityId: string, day: number) =>
  prisma.activityEntry.create({
    data: { userId: current.id, activityId, quantity: 60, datetime: new Date(2026, 9, day) },
  });
const get = async (path: string) => (await fetch(`${baseUrl}${path}`)).json();
const post = async (path: string, body: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

describe("duplicate activities", () => {
  it("suggests folding the activity with fewer logs into the other by name, without Jev", async () => {
    const hike = await createActivity("Hike");
    const hiking = await createActivity("Hiking");
    await log(hike.id, 1);
    await log(hike.id, 2);
    await log(hiking.id, 3);
    await prisma.plan.create({
      data: { userId: current.id, goal: "Walk more", activities: { connect: { id: hiking.id } } },
    });

    const { duplicate } = await get(`/activities/${hiking.id}/duplicate?byMeaning=true`);

    expect(duplicate).toMatchObject({
      match: "name",
      keep: { id: hike.id },
      remove: { id: hiking.id },
      entriesToMove: 1,
      plansToUpdate: 1,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("never suggests activities counted in another measure", async () => {
    const hiking = await createActivity("Hiking", "kilometers");
    await createActivity("Hike", "minutes");
    expect((await get(`/activities/${hiking.id}/duplicate?byMeaning=true`)).duplicate).toBeNull();
  });

  it("asks Jev only after creation, and only trusts a clear answer", async () => {
    const running = await createActivity("Running", "minutes", "🏃");
    const jogging = await createActivity("Jogging", "minutes", "🏃");
    await createActivity("Yoga", "minutes", "🧘");

    expect((await get(`/activities/${jogging.id}/duplicate`)).duplicate).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();

    // Candidates are shortlisted by usage; with no logs the order is creation order.
    evaluate.mockResolvedValueOnce({
      answers: {
        existing_0: { type: "boolean", probability: 0.95 },
        existing_1: { type: "boolean", probability: 0.04 },
      },
    });
    const { duplicate } = await get(`/activities/${jogging.id}/duplicate?byMeaning=true`);
    expect(duplicate).toMatchObject({ match: "meaning", keep: { id: running.id } });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ model: "typesafe-ai/jev" }));

    evaluate.mockResolvedValueOnce({
      answers: {
        existing_0: { type: "boolean", probability: 0.9 },
        existing_1: { type: "boolean", probability: 0.88 },
      },
    });
    expect((await get(`/activities/${jogging.id}/duplicate?byMeaning=true`)).duplicate).toBeNull();
  });

  it("saves the activity anyway when Jev fails", async () => {
    await createActivity("Running", "minutes", "🏃");
    const jogging = await createActivity("Jogging", "minutes", "🏃");
    evaluate.mockRejectedValueOnce(new Error("timeout"));
    expect((await get(`/activities/${jogging.id}/duplicate?byMeaning=true`)).duplicate).toBeNull();
  });
});

describe("merging activities", () => {
  it("moves logs, planned sessions and plans to the kept activity and removes the other", async () => {
    const hike = await createActivity("Hike");
    const hiking = await createActivity("Hiking");
    const entry = await log(hiking.id, 3);
    await log(hike.id, 3); // same day: both logs are kept
    const onlyHiking = await prisma.plan.create({
      data: { userId: current.id, goal: "Hills", activities: { connect: { id: hiking.id } } },
    });
    const both = await prisma.plan.create({
      data: {
        userId: current.id,
        goal: "Outdoors",
        progressCalculatedAt: new Date(),
        activities: { connect: [{ id: hike.id }, { id: hiking.id }] },
      },
    });
    await prisma.planSession.create({
      data: { planId: onlyHiking.id, activityId: hiking.id, date: new Date(2026, 9, 20), quantity: 90 },
    });

    const { status, body } = await post(`/activities/${hiking.id}/merge`, {
      intoActivityId: hike.id,
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ activity: { id: hike.id }, entriesMoved: 1, plansUpdated: 2 });
    expect((await prisma.activityEntry.findUnique({ where: { id: entry.id } }))?.activityId).toBe(hike.id);
    expect(await prisma.activityEntry.count({ where: { activityId: hike.id } })).toBe(2);
    expect(await prisma.planSession.count({ where: { activityId: hike.id } })).toBe(1);
    for (const plan of [onlyHiking, both]) {
      const after = await prisma.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { activities: true },
      });
      expect(after.activities.map((a) => a.id)).toEqual([hike.id]);
      expect(after.progressCalculatedAt).toBeNull();
    }
    expect((await prisma.activity.findUnique({ where: { id: hiking.id } }))?.deletedAt).toBeTruthy();
  });

  it("converts logs and planned sessions from hours into the kept activity's minutes", async () => {
    const hike = await createActivity("Hike", "minutes");
    const hiking = await createActivity("Hiking", "hours");
    await log(hike.id, 1);
    await log(hike.id, 2);
    const hours = await prisma.activityEntry.create({
      data: { userId: current.id, activityId: hiking.id, quantity: 2, datetime: new Date(2026, 9, 3) },
    });
    const plan = await prisma.plan.create({
      data: { userId: current.id, goal: "Hills", activities: { connect: { id: hiking.id } } },
    });
    const session = await prisma.planSession.create({
      data: { planId: plan.id, activityId: hiking.id, date: new Date(2026, 9, 20), quantity: 3 },
    });

    const { duplicate } = await get(`/activities/${hiking.id}/duplicate`);
    expect(duplicate).toMatchObject({
      keep: { id: hike.id },
      conversion: { activityId: hiking.id, from: "hours", to: "minutes", factor: 60 },
    });

    const { status, body } = await post(`/activities/${hiking.id}/merge`, { intoActivityId: hike.id });
    expect(status).toBe(200);
    expect(body.activity.measure).toBe("minutes");
    expect((await prisma.activityEntry.findUniqueOrThrow({ where: { id: hours.id } })).quantity).toBe(120);
    expect((await prisma.planSession.findUniqueOrThrow({ where: { id: session.id } })).quantity).toBe(180);
    // Hike's own logs were already in minutes.
    expect(
      (await prisma.activityEntry.findMany({ where: { activityId: hike.id } })).map((e) => e.quantity).sort(),
    ).toEqual([120, 60, 60].sort());
  });

  it("switches the kept activity to the smaller unit when it is the one in hours", async () => {
    const hike = await createActivity("Hike", "hours");
    const hiking = await createActivity("Hiking", "minutes");
    const hikeLog = await prisma.activityEntry.create({
      data: { userId: current.id, activityId: hike.id, quantity: 2, datetime: new Date(2026, 9, 1) },
    });
    await prisma.activityEntry.create({
      data: { userId: current.id, activityId: hike.id, quantity: 1, datetime: new Date(2026, 9, 2) },
    });
    const hikingLog = await log(hiking.id, 3);

    const { body } = await post(`/activities/${hiking.id}/merge`, { intoActivityId: hike.id });

    expect(body.activity).toMatchObject({ id: hike.id, measure: "minutes" });
    expect((await prisma.activityEntry.findUniqueOrThrow({ where: { id: hikeLog.id } })).quantity).toBe(120);
    expect((await prisma.activityEntry.findUniqueOrThrow({ where: { id: hikingLog.id } })).quantity).toBe(60);
  });

  it("refuses to add up logs in different measures", async () => {
    const km = await createActivity("Hiking", "kilometers");
    const minutes = await createActivity("Hike", "minutes");
    const miles = await createActivity("Hike", "miles");
    const { status, body } = await post(`/activities/${km.id}/merge`, { intoActivityId: minutes.id });
    expect(status).toBe(400);
    expect(body.error).toMatch(/kilometers/);
    // No exact conversion between miles and kilometers either.
    expect((await post(`/activities/${km.id}/merge`, { intoActivityId: miles.id })).status).toBe(400);
    expect((await prisma.activity.findUnique({ where: { id: km.id } }))?.deletedAt).toBeNull();
  });

  it("only merges the signed-in person's own activities", async () => {
    const mine = await createActivity("Hike");
    const other = await prisma.user.create({
      data: {
        id: `${prefix}-${randomUUID()}`,
        email: `${randomUUID()}@example.invalid`,
        clerkId: `clerk_${randomUUID()}`,
      },
    });
    const theirs = await prisma.activity.create({
      data: { userId: other.id, title: "Hiking", measure: "minutes", emoji: "🥾" },
    });
    const { status } = await post(`/activities/${theirs.id}/merge`, { intoActivityId: mine.id });
    expect(status).toBe(404);
  });
});
