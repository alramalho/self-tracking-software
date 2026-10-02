import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchVoiceLogToPlans } from "../voice-log/planMatcher";

const evaluate = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  experimental_evaluate: evaluate,
}));

const baseInput = {
  transcript: "The run felt good. Try a longer route next time.",
  activities: [
    {
      activityId: "running",
      title: "Running",
      emoji: "🏃",
      measure: "kilometers",
      quantity: 5,
      date: "2026-09-18",
      confidence: 0.99,
    },
  ],
  note: {
    title: "Voice note",
    text: "Try a longer route next time.",
    date: "2026-09-18",
    confidence: 0.95,
  },
  unresolved: [
    {
      text: "Try a longer route next time",
      reason: "This is future plan guidance.",
    },
  ],
};

function plan(id: string, outlineType: "SPECIFIC" | "TIMES_PER_WEEK") {
  return {
    id,
    goal: "Build a stronger running base",
    emoji: "🏃",
    outlineType,
    notes: null,
    activities: [{ id: "running", title: "Running", measure: "kilometers" }],
  };
}

describe("voice-log plan matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "test-key";
    evaluate.mockResolvedValue({
      answers: {
        isPlanGuidance: { probability: 0.98 },
        activityMatches: { probability: 0.98 },
        fitsThisPlan: { probability: 0.96 },
      },
    });
  });

  it("returns one high-confidence match for a structured plan", async () => {
    const matches = await matchVoiceLogToPlans({
      ...baseInput,
      plans: [plan("running-plan", "SPECIFIC")],
    });

    expect(matches).toEqual([
      expect.objectContaining({
        planId: "running-plan",
        activityId: "running",
        contextText: "Try a longer route next time",
      }),
    ]);
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "typesafe-ai/jev" }),
    );
  });

  it("does not attach the note to a loose frequency plan", async () => {
    const matches = await matchVoiceLogToPlans({
      ...baseInput,
      plans: [plan("running-plan", "TIMES_PER_WEEK")],
    });

    expect(matches).toEqual([]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("does not guess when two plans are equally strong", async () => {
    const matches = await matchVoiceLogToPlans({
      ...baseInput,
      plans: [
        plan("running-plan-a", "SPECIFIC"),
        plan("running-plan-b", "SPECIFIC"),
      ],
    });

    expect(matches).toEqual([]);
  });
});
