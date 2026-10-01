import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../utils/prisma";
import { ogRouter } from "./og";

// Fail closed: these tests create and delete only synthetic users in the isolated local database.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
)
  throw new Error("Link preview tests require the isolated local database on port 55432.");

const prefix = `og-test-${randomUUID()}`;
const names = ["alice", "bob"] as const;
type Name = (typeof names)[number];
const id = (name: Name) => `${prefix}-${name}`;
const inviteCode = `${prefix}-invite`;
let circleId: string;
let server: Server;
let baseUrl: string;

// A proven member: a plan in the circle and one photo log with its preview already cached.
async function join(name: Name, role: "OWNER" | "MEMBER") {
  const activity = await prisma.activity.create({
    data: { userId: id(name), title: "Running", emoji: "🏃", measure: "km" },
  });
  const plan = await prisma.plan.create({
    data: {
      userId: id(name),
      goal: "Run a 10K under 50 minutes",
      emoji: "🏃",
      finishingDate: new Date(Date.now() + 90 * 86400000),
      outlineType: "TIMES_PER_WEEK",
      timesPerWeek: 4,
      visibility: "PRIVATE",
      activities: { connect: { id: activity.id } },
    },
  });
  await prisma.circleMember.create({
    data: { circleId, userId: id(name), planId: plan.id, role, provenAt: new Date() },
  });
  await prisma.activityEntry.create({
    data: {
      userId: id(name),
      activityId: activity.id,
      quantity: 5,
      datetime: new Date(),
      imageUrls: ["https://example.test/run.jpg"],
      imagePreview: "data:image/jpeg;base64,AA==",
    },
  });
}

const get = (path: string) => fetch(`${baseUrl}${path}`, { redirect: "manual" });

describe("link previews", () => {
  beforeAll(async () => {
    for (const name of names)
      await prisma.user.create({
        data: {
          id: id(name),
          email: `${id(name)}@test.local`,
          name: `${name[0].toUpperCase()}${name.slice(1)} Test`,
          username: `${name}${randomUUID().slice(0, 6)}`,
        },
      });
    const circle = await prisma.circle.create({ data: { name: "Morning 10K", emoji: "🏃", inviteCode } });
    circleId = circle.id;
    await join("alice", "OWNER");

    const app = express();
    // Like the real server: helmet's defaults must not stop other sites from showing the image.
    app.use(helmet());
    app.use("/og", ogRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

    // Only the test server is reachable: emoji and photos can't be fetched, like a crawler hitting us offline.
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      String(url).startsWith(baseUrl) ? realFetch(url, init) : Promise.reject(new Error("offline")),
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.circle.deleteMany({ where: { id: circleId } });
    await prisma.activityEntry.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.plan.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.activity.deleteMany({ where: { userId: { in: names.map(id) } } });
    await prisma.user.deleteMany({ where: { id: { in: names.map(id) } } });
  });

  it("describes a forming circle to anyone, without signing in", async () => {
    const response = await get(`/og/circle-invite/${inviteCode}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      title: "Join 🏃 Morning 10K",
      description: "Alice started this circle. Be one of the first: post a photo from a session to join.",
      image: `${baseUrl}/og/circle-invite/${inviteCode}.png`,
    });
  });

  it("describes an active circle once a second person has posted", async () => {
    await join("bob", "MEMBER");
    const meta = await (await get(`/og/circle-invite/${inviteCode}`)).json();
    expect(meta.description).toBe("Alice and 1 other are in. Post a photo from a session to join.");
  });

  it("serves the preview image, even when emoji and photos can't be loaded", async () => {
    const response = await get(`/og/circle-invite/${inviteCode}.png`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=600");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    const image = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    expect(image).toMatchObject({ format: "png", width: 1200, height: 630 });
  });

  it("answers an unknown invite with a 404, and its image with the default one", async () => {
    expect((await get("/og/circle-invite/nope")).status).toBe(404);
    const image = await get("/og/circle-invite/nope.png");
    expect(image.status).toBe(302);
    expect(image.headers.get("location")).toBe("https://app.tracking.so/images/og.png");
  });
});
