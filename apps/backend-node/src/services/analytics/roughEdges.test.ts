import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma", () => ({
  prisma: { user: { findMany: async () => [{ id: "u1", username: "alex" }] } },
}));

import { roughEdgesSummary } from "./roughEdges";

describe("roughEdgesSummary", () => {
  it("counts last week's rough edges per kind and lists the latest first", async () => {
    const now = Date.now();
    const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
    const summary = await roughEdgesSummary([
      { at: at(24 * 9), kind: "coach_failed", userId: "u1" },
      { at: at(5), kind: "coach_fallback", userId: "u1", detail: "openai/gpt-5.6-luna" },
      { at: at(4), kind: "chat_interrupted", userId: "u1" },
      { at: at(3), kind: "coach_fallback", userId: "u2" },
      { at: at(2), kind: "nonsense" as any, userId: "u1" },
    ]);
    expect(summary.kinds).toEqual([
      { kind: "coach_fallback", label: "Coach skipped its reply tool", count: 2, people: 2 },
      { kind: "chat_interrupted", label: "Chat reply cut off", count: 1, people: 1 },
    ]);
    expect(summary.recent.map((r) => [r.kind, r.username])).toEqual([
      ["coach_fallback", null],
      ["chat_interrupted", "alex"],
      ["coach_fallback", "alex"],
    ]);
  });
});
