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

  it("matches entries on the same day even hours apart", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T08:00:00Z"),
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T20:00:00Z"),
    })).toBeGreaterThanOrEqual(50);
  });

  it("rejects entries on different days", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T23:00:00Z"),
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-07T01:00:00Z"),
    })).toBe(0);
  });

  it("skips candidate lookup when the user explicitly selected an invitee", () => {
    expect(shouldLookupSharedActivityCandidates(undefined)).toBe(true);
    expect(shouldLookupSharedActivityCandidates("")).toBe(true);
    expect(shouldLookupSharedActivityCandidates("friend-user-id")).toBe(false);
  });

  it("matches cross-language activities with same kind", () => {
    const input = {
      sourceTitle: "Correr",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceKind: "running" as const,
      candidateTitle: "Running",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:15:00Z"),
      candidateKind: "running" as const,
    };

    expect(scoreSharedActivityCandidate(input)).toBeGreaterThanOrEqual(50);
    expect(isLikelySharedActivity(input)).toBe(true);
  });

  it("rejects different kinds even with close time", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Gym",
      sourceMeasure: "minutes",
      sourceEmoji: "🏋️",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceKind: "gym",
      candidateTitle: "Running",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:05:00Z"),
      candidateKind: "running",
    })).toBe(0);
  });

  it("falls back to title matching when either kind is other", () => {
    const input = {
      sourceTitle: "Knitting",
      sourceMeasure: "minutes",
      sourceEmoji: "🧶",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceKind: "other" as const,
      candidateTitle: "Knitting",
      candidateMeasure: "minutes",
      candidateEmoji: "🧶",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateKind: "other" as const,
    };

    expect(scoreSharedActivityCandidate(input)).toBeGreaterThanOrEqual(50);
  });
});
