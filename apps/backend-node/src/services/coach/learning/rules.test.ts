import { describe, expect, it } from "vitest";
import { coverageAsk, skipCoverage, answerCoverage } from "@tsw/prisma/follow-through/coverage";
import { coachItems } from "@tsw/prisma/follow-through/coach-inbox";

// Wednesday 18 Nov 2026, local noon.
const now = new Date(2026, 10, 18, 12);
const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).toISOString();
const chinese = { id: "zh", goal: "Conversational Chinese", category: "language_learning", activities: [{ id: "a" }], createdAt: at(1), outlineType: "SPECIFIC" };
const marathon = { ...chinese, id: "run", goal: "Half marathon", category: "running", activities: [{ id: "r" }] };
const logged = (day: number, description: string | null = null, activityId = "a") => ({ id: `e${day}`, activityId, datetime: at(day), quantity: 20, description });

describe("What did you cover?", () => {
  it("asks about today's or yesterday's learning log without a note", () => {
    expect(coverageAsk({ plan: chinese, entries: [logged(18)], now })?.id).toBe("e18");
    expect(coverageAsk({ plan: chinese, entries: [logged(17)], now })?.id).toBe("e17");
    expect(coverageAsk({ plan: chinese, entries: [logged(16)], now })).toBeNull();
    expect(coverageAsk({ plan: chinese, entries: [logged(18, "numbers 1–10")], now })).toBeNull();
  });
  it("never asks on a running plan", () => {
    expect(coverageAsk({ plan: marathon, entries: [logged(18, null, "r")], now })).toBeNull();
  });
  it("asks once a week: an answer or a skip this week closes it", () => {
    expect(coverageAsk({ plan: chinese, entries: [logged(18)], coverage: answerCoverage(undefined, new Date(2026, 10, 16)), now })).toBeNull();
    expect(coverageAsk({ plan: chinese, entries: [logged(18)], coverage: skipCoverage(undefined, new Date(2026, 10, 16)), now })).toBeNull();
    // Last week's answer doesn't count.
    expect(coverageAsk({ plan: chinese, entries: [logged(18)], coverage: answerCoverage(undefined, new Date(2026, 10, 12)), now })).not.toBeNull();
  });
  it("two skips in a row keep it quiet for two weeks; an answer resets the count", () => {
    const once = skipCoverage(undefined, new Date(2026, 10, 4));
    expect(once.skips).toBe(1);
    const twice = skipCoverage(once, new Date(2026, 10, 11));
    expect(twice).toMatchObject({ skips: 0, quietUntil: "2026-11-25" });
    expect(coverageAsk({ plan: chinese, entries: [logged(18)], coverage: twice, now })).toBeNull();
    expect(answerCoverage(once).skips).toBe(0);
  });
  it("shows on the Coach tab only when nothing else waits", () => {
    const state = {
      version: 1 as const, enabled: true, pausedAt: null, sessions: {}, checks: {}, draft: null,
      supports: { zh: { coaching: { role: "consistency" } } } as never,
    };
    const base = { plans: [chinese], entries: [logged(18)], state, attention: [], metrics: [], checkedInToday: true, answeredMisses: [], now };
    expect(coachItems(base).map((i) => i.kind)).toEqual(["coverage"]);
    const attention = { dedupeKey: "x", title: "Something", planGoal: "Chinese", planEmoji: null, planIds: ["zh"], generatedAt: at(18), primaryAction: { prompt: "" } };
    expect(coachItems({ ...base, attention: [attention] }).map((i) => i.kind)).toEqual(["attention"]);
  });
});
