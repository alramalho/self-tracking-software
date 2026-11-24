import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma", () => ({
  prisma: { user: { findMany: async () => [{ id: "u1", username: "alex" }] } },
}));

import { coachCosts } from "./coachCosts";

describe("coachCosts", () => {
  it("adds up the coach's calls by part, model and person, and leaves the rest out", async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const costs = await coachCosts(30, [
      { at: now, kind: "agent.generate", name: "coach", model: "deepseek/deepseek-v4.1-flash", costUsd: 0.01, userId: "u1" },
      { at: now, kind: "generateText", name: "coach_web_search", model: "openai/gpt-6-luna", costUsd: 0.03, userId: "u1" },
      { at: now, kind: "agent.generate", name: null, model: "openai/gpt-5.6-luna", costUsd: 0.02 },
      { at: now, kind: "generateText", name: "coach_scheduled", model: "deepseek/deepseek-v4.1-flash", costUsd: 0.001, userId: "u2" },
      { at: now, kind: "generateObject", name: "voice_log", model: "openai/gpt-6-luna", costUsd: 0.5, userId: "u1" },
      { at: old, kind: "agent.generate", name: "coach", model: "openai/gpt-5.6-luna", costUsd: 9 },
    ]);
    expect(costs.totalUsd).toBeCloseTo(0.061);
    expect(costs.parts.map((p) => [p.part, p.calls])).toEqual([["chat", 2], ["search", 1], ["checkins", 1]]);
    expect(costs.perReplyUsd).toBeCloseTo(0.03);
    expect(costs.models[0]).toMatchObject({ model: "openai/gpt-6-luna", calls: 1 });
    expect(costs.people).toEqual([
      { username: "alex", usd: 0.04, calls: 2 },
      { username: null, usd: 0.001, calls: 1 },
    ]);
    expect(costs.perDay).toHaveLength(30);
  });
});
