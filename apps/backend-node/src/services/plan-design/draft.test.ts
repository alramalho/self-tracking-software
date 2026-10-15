import { describe, expect, it } from "vitest";
import { planDesignDraftSchema } from "./draft";

const habit = {
  orientation: "CONSISTENCY",
  goalSpec: { metric: null, value: null, unit: null, text: null, chosenByUser: false },
  baseline: { text: "Twice a week", measurements: [] },
  activities: [{ key: "reading", title: "Reading", measure: "pages", emoji: "📚" }],
  preferredDays: 3,
  coachNote: null,
  fixedDate: null,
  asked: [],
  options: [],
  selected: null,
  startDate: "2026-10-15",
};
const confidence = { score: 8, why: "I read every night last summer", question: "Why an 8, and not a 5?", askedAt: "2026-10-15T10:00:00.000Z" };

describe("planDesignDraftSchema confidence", () => {
  it("keeps how sure the person was and why", () => {
    expect(planDesignDraftSchema.parse({ ...habit, confidence }).confidence).toEqual(confidence);
  });

  it("still accepts designs from app versions that never asked", () => {
    expect(planDesignDraftSchema.parse(habit).confidence).toBeUndefined();
  });

  it("rejects a score off the 1–10 dial", () => {
    expect(() => planDesignDraftSchema.parse({ ...habit, confidence: { ...confidence, score: 11 } })).toThrow();
  });
});
