import { describe, expect, it } from "vitest";
import { describeConfidence } from "./confidence";

describe("describeConfidence", () => {
  it("gives the coach the score and the person's own words", () => {
    const line = describeConfidence({ score: 7, why: "I already run twice a week", question: "Why a 7 and not a 4?", askedAt: "2026-10-15T10:00:00Z" });
    expect(line).toContain("7/10");
    expect(line).toContain("(2026-10-15)");
    expect(line).toContain('"I already run twice a week"');
  });

  it("keeps only the score when they skipped the why", () => {
    expect(describeConfidence({ score: 5, why: "  ", question: "Why a 5 and not a 2?", askedAt: "2026-10-15" })).toBe(
      "Confidence when they set it up (2026-10-15): 5/10.",
    );
  });

  it("says nothing for plans made before the question existed", () => {
    expect(describeConfidence(null)).toBe("");
    expect(describeConfidence({})).toBe("");
  });
});
