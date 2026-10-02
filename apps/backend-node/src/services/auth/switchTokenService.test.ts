import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSwitchToken } from "./types";

const rows = vi.hoisted(() => [] as StoredSwitchToken[]);
const db = vi.hoisted(() => ({
  accountSwitchToken: {
    create: vi.fn(async ({ data }) => {
      rows.push({ id: `token-${rows.length}`, lastUsedAt: new Date(), ...data });
    }),
    findUnique: vi.fn(async ({ where }) => {
      const row = rows.find((candidate) => candidate.tokenHash === where.tokenHash);
      return row ? { ...row, user: users[row.userId] } : null;
    }),
    update: vi.fn(async ({ where, data }) => {
      Object.assign(rows.find((row) => row.id === where.id)!, data);
    }),
    delete: vi.fn(async ({ where }) => {
      rows.splice(rows.findIndex((row) => row.id === where.id), 1);
    }),
    deleteMany: vi.fn(async ({ where }) => {
      const index = rows.findIndex((row) => row.tokenHash === where.tokenHash);
      if (index >= 0) rows.splice(index, 1);
    }),
  },
}));
vi.mock("@/utils/prisma", () => ({ prisma: db }));

import { issueSwitchToken, redeemSwitchToken, revokeSwitchToken } from "./switchTokenService";

const users: Record<string, { id: string; deletedAt: Date | null }> = {
  alex: { id: "alex", deletedAt: null },
  gone: { id: "gone", deletedAt: new Date("2026-09-01") },
};
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe("account switch tokens", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("signs a device back into the account the token was issued for", async () => {
    const token = await issueSwitchToken("alex");
    expect((await redeemSwitchToken(token))?.id).toBe("alex");
    expect(await redeemSwitchToken(token)).not.toBeNull();
  });

  it("never stores the plaintext token", async () => {
    const token = await issueSwitchToken("alex");
    expect(rows[0].tokenHash).not.toBe(token);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("rejects unknown tokens and tokens of deleted accounts", async () => {
    expect(await redeemSwitchToken("made-up")).toBeNull();
    expect(await redeemSwitchToken(await issueSwitchToken("gone"))).toBeNull();
  });

  it("stops working once the account logs out on that device", async () => {
    const token = await issueSwitchToken("alex");
    await revokeSwitchToken(token);
    expect(await redeemSwitchToken(token)).toBeNull();
  });

  it("expires after 90 days without a switch, and each switch renews it", async () => {
    const renewed = await issueSwitchToken("alex");
    rows[0].lastUsedAt = daysAgo(89);
    expect(await redeemSwitchToken(renewed)).not.toBeNull();
    expect(rows[0].lastUsedAt.getTime()).toBeGreaterThan(daysAgo(1).getTime());

    rows[0].lastUsedAt = daysAgo(91);
    expect(await redeemSwitchToken(renewed)).toBeNull();
    expect(rows).toHaveLength(0);
  });
});
