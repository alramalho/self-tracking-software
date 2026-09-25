import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";

// Fail closed: synthetic users in the isolated local database only.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (database.hostname !== "127.0.0.1" || database.port !== "55432")
  throw new Error("Account deletion tests require the isolated local database on port 55432.");

const { deleteUser, deletePrefix, cancel, retrieve } = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  deletePrefix: vi.fn(async () => 0),
  cancel: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("@clerk/express", async (original) => ({
  ...(await original<object>()),
  clerkClient: { users: { deleteUser } },
}));
vi.mock("stripe", () => ({
  default: vi.fn(() => ({ subscriptions: { retrieve, cancel } })),
}));
vi.mock("../../services/s3Service", () => ({ s3Service: { deletePrefix } }));
vi.mock("../../services/telegramService", () => ({
  TelegramService: vi.fn(() => ({ sendAlert: vi.fn(), sendMessage: vi.fn() })),
}));
// Signed in as whoever the test says, without Clerk.
let current: any;
vi.mock("../../middleware/auth", () => ({
  requireAuth: [(req: any, _res: any, next: any) => ((req.user = current), next())],
}));

const prefix = `delete-account-test-${randomUUID()}`;
let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  const { usersRouter } = await import("../users");
  const app = express().use(express.json()).use("/users", usersRouter);
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
      stripeSubscriptionId: "sub_test",
    },
  });
  retrieve.mockResolvedValue({ status: "active" });
});

const deleteAccount = () => fetch(`${baseUrl}/users/user`, { method: "DELETE" });
const stillThere = async () => !!(await prisma.user.findUnique({ where: { id: current.id } }));

describe("DELETE /users/user", () => {
  it("cancels billing, removes the sign-in, the data and the photos", async () => {
    const response = await deleteAccount();
    expect(response.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith("sub_test");
    expect(deleteUser).toHaveBeenCalledWith(current.clerkId);
    expect(deletePrefix).toHaveBeenCalledWith(`users/${current.id}/`);
    expect(await stillThere()).toBe(false);
  });

  it("deletes nothing when the subscription can't be cancelled", async () => {
    cancel.mockRejectedValueOnce(new Error("stripe down"));
    const response = await deleteAccount();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toMatch(/nothing was deleted/);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(await stillThere()).toBe(true);
  });

  it("deletes nothing when the sign-in can't be removed, so retrying works", async () => {
    deleteUser.mockRejectedValueOnce(Object.assign(new Error("clerk down"), { status: 503 }));
    expect((await deleteAccount()).status).toBe(502);
    expect(await stillThere()).toBe(true);
    expect((await deleteAccount()).status).toBe(200);
    expect(await stillThere()).toBe(false);
  });

  it("skips an already-cancelled subscription and an already-deleted sign-in", async () => {
    retrieve.mockResolvedValueOnce({ status: "canceled" });
    deleteUser.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }));
    expect((await deleteAccount()).status).toBe(200);
    expect(cancel).not.toHaveBeenCalled();
    expect(await stillThere()).toBe(false);
  });
});
