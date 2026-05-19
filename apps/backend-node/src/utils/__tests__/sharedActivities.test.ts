import { describe, expect, it } from "vitest";
import {
  isLikelySharedActivity,
  normalizeActivityLabel,
  scoreSharedActivityCandidate,
  shouldLookupSharedActivityCandidates,
} from "../sharedActivities";

describe("shared activity matching", () => {
  it("normalizes noisy activity labels", () => {
    expect(normalizeActivityLabel("  Morning-Run!! ")).toBe("morning run");
  });

  it("scores matching friend activities within the time window", () => {
    const input = {
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:25:00Z"),
    };

    expect(scoreSharedActivityCandidate(input)).toBeGreaterThanOrEqual(100);
    expect(isLikelySharedActivity(input)).toBe(true);
  });

  it("rejects entries that only overlap in time", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      candidateTitle: "Read",
      candidateMeasure: "pages",
      candidateEmoji: "📚",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
    })).toBe(0);
  });

  it("rejects entries outside the three hour window", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T14:01:00Z"),
    })).toBe(0);
  });

  it("skips candidate lookup when the user explicitly selected an invitee", () => {
    expect(shouldLookupSharedActivityCandidates(undefined)).toBe(true);
    expect(shouldLookupSharedActivityCandidates("")).toBe(true);
    expect(shouldLookupSharedActivityCandidates("friend-user-id")).toBe(false);
  });
});
