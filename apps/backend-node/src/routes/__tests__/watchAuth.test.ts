import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The watch signs itself out on a 401 and keeps its login on anything else,
// so a database failure must never be reported as a 401.
process.env.WATCH_AUTH_SECRET = "watch-auth-test-secret";

// A plain stub: a vi.fn that rejects is reported by vitest as a test failure.
const users = vi.hoisted(() => {
  const stub = { lookup: async (_id: string): Promise<unknown> => null };
  return { stub, getUserById: (id: string) => stub.lookup(id) };
});
vi.mock("../../services/userService", () => ({ userService: users }));
vi.mock("../../services/telegramService", () => ({
  TelegramService: class {
    sendAlert = vi.fn();
    sendMessage = vi.fn();
  },
}));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: {},
}));

const { issueWatchAuthTokens } = await import("../../services/auth/watchTokenService");
const { requireAuth } = await import("../../middleware/auth");
const { default: authRouter } = await import("../auth");

const user = { id: "user-1", deletedAt: null, suspendedAt: null };
let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.get("/me", ...requireAuth, (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  users.stub.lookup = async () => null;
});

const refresh = (refreshToken: string) =>
  fetch(`${baseUrl}/auth/watch-refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
const me = (accessToken: string) =>
  fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });

describe("watch refresh", () => {
  it("issues a new pair for a valid refresh token", async () => {
    users.stub.lookup = async () => user;
    const response = await refresh(issueWatchAuthTokens(user.id).refreshToken);
    expect(response.status).toBe(200);
    expect(Object.keys(await response.json()).sort()).toEqual(["accessToken", "refreshToken"]);
  });

  it("rejects a forged or access token with 401", async () => {
    expect((await refresh("not-a-token")).status).toBe(401);
    expect((await refresh(issueWatchAuthTokens(user.id).accessToken)).status).toBe(401);
  });

  it("rejects a deleted user with 401", async () => {
    users.stub.lookup = async () => ({ ...user, deletedAt: new Date() });
    expect((await refresh(issueWatchAuthTokens(user.id).refreshToken)).status).toBe(401);
  });

  it("answers 500 when the database fails", async () => {
    users.stub.lookup = async () => {
      throw new Error("connection reset");
    };
    expect((await refresh(issueWatchAuthTokens(user.id).refreshToken)).status).toBe(500);
  });
});

describe("watch access token", () => {
  it("authenticates the watch user", async () => {
    users.stub.lookup = async () => user;
    expect((await me(issueWatchAuthTokens(user.id).accessToken)).status).toBe(200);
  });

  it("answers 500 when the database fails", async () => {
    users.stub.lookup = async () => {
      throw new Error("connection reset");
    };
    expect((await me(issueWatchAuthTokens(user.id).accessToken)).status).toBe(500);
  });

  it("answers 401 for a token that is not a watch token", async () => {
    expect((await me("not-a-token")).status).toBe(401);
  });
});
