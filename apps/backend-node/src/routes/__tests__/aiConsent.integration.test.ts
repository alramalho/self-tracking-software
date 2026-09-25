import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";

// Fail closed: synthetic users in the isolated local database only.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
)
  throw new Error("AI consent tests require the isolated local database on port 55432.");

const external = vi.hoisted(() => ({
  runMonitoring: vi.fn(async () => "quiet"),
  speechToText: vi.fn(async () => "hello"),
}));
vi.mock("../../services/coach/monitoring/run", () => ({ runMonitoring: external.runMonitoring }));
vi.mock("../../services/sttService", () => ({
  sttService: { speechToText: external.speechToText },
}));
vi.mock("../../services/notificationService", () => ({
  notificationService: { sendPushNotification: vi.fn(), createAndProcessNotification: vi.fn() },
}));
vi.mock("../../services/telegramService", () => ({
  TelegramService: class {
    sendAlert = vi.fn();
    sendMessage = vi.fn();
  },
}));
vi.mock("stripe", () => ({ default: class {} }));
// Signed in as whoever the test says, without Clerk. Re-read so consent changes apply.
let currentId = "";
vi.mock("../../middleware/auth", () => ({
  requireAuth: [
    async (req: any, _res: any, next: any) => {
      req.user = await prisma.user.findUnique({ where: { id: currentId } });
      next();
    },
  ],
}));

const prefix = `ai-consent-test-${randomUUID()}`;
let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  const { followThroughRouter } = await import("../followThrough");
  const { chatsRouter } = await import("../chats");
  const { aiRouter } = await import("../ai");
  const { usersRouter } = await import("../users");
  const app = express()
    .use(express.json())
    .use("/follow-through", followThroughRouter)
    .use("/chats", chatsRouter)
    .use("/ai", aiRouter)
    .use("/users", usersRouter);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000); // loading four routers is slow when the whole suite runs in parallel
afterAll(async () => {
  server.close();
  delete process.env.AI_CONSENT_ENFORCED;
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});
beforeEach(async () => {
  vi.clearAllMocks();
  process.env.AI_CONSENT_ENFORCED = "true";
  currentId = (
    await prisma.user.create({
      data: { id: `${prefix}-${randomUUID()}`, email: `${randomUUID()}@example.invalid` },
    })
  ).id;
});

const post = (path: string, body: unknown = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const choose = (granted: unknown) =>
  fetch(`${baseUrl}/users/ai-consent`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ granted }),
  });
const transcribe = () => {
  const form = new FormData();
  form.append("audio_file", new Blob([Buffer.from("RIFFfake")], { type: "audio/wav" }), "a.wav");
  return fetch(`${baseUrl}/ai/transcribe`, { method: "POST", body: form });
};
const aiRoutes = [
  () => post("/follow-through/onboarding/interview"),
  () => post("/chats/some-chat/messages/stream", { message: "hi", coachVersion: "v2" }),
  transcribe,
];

describe("AI consent", () => {
  it("blocks AI routes for someone who never allowed AI", async () => {
    for (const call of aiRoutes) {
      const response = await call();
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: "Turn on AI features in Settings to use this.",
        code: "AI_CONSENT_REQUIRED",
      });
    }
    expect(external.speechToText).not.toHaveBeenCalled();
  });

  it("PUT /users/ai-consent turns AI on and off", async () => {
    expect((await choose("yes")).status).toBe(400);

    const granted = await choose(true);
    expect(granted.status).toBe(200);
    expect((await granted.json()).aiConsentGrantedAt).toBeTruthy();
    expect((await transcribe()).status).toBe(200);
    expect(external.speechToText).toHaveBeenCalledTimes(1);
    // Past the gate: these now fail on their own validation, not on consent.
    expect((await post("/follow-through/onboarding/interview")).status).toBe(400);
    expect((await post("/chats/missing-chat/messages/stream", { message: "hi", coachVersion: "v2" })).status).toBe(404);

    expect((await choose(false)).status).toBe(200);
    expect((await transcribe()).status).toBe(403);
  });

  it("changes nothing while the flag is off", async () => {
    delete process.env.AI_CONSENT_ENFORCED;
    expect((await transcribe()).status).toBe(200);
  });

  it("the plan monitoring job skips people who did not allow AI", async () => {
    const { initialState } = await import("../../services/follow-through/model");
    const { changeState } = await import("../../services/follow-through/store");
    const { deliverPlanMonitoring } = await import("../../services/coach/monitoring/service");
    await changeState(currentId, async (state) =>
      Object.assign(state, {
        ...initialState(),
        enabled: true,
        supports: { plan: { coaching: { role: "training" } } as any },
      }),
    );

    await deliverPlanMonitoring();
    expect(external.runMonitoring).not.toHaveBeenCalled();

    await choose(true);
    await deliverPlanMonitoring();
    expect(external.runMonitoring).toHaveBeenCalledTimes(1);
  });
});
