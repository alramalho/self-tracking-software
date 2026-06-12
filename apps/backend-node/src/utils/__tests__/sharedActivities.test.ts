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
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:25:00Z"),
      candidateTimezone: "Europe/Lisbon",
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
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Read",
      candidateMeasure: "pages",
      candidateEmoji: "📚",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateTimezone: "Europe/Lisbon",
    })).toBe(0);
  });

  it("matches entries on the same day even hours apart", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T08:00:00Z"),
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T20:00:00Z"),
      candidateTimezone: "Europe/Lisbon",
    })).toBeGreaterThanOrEqual(50);
  });

  it("rejects entries on different days", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T23:00:00Z"),
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-07T01:00:00Z"),
      candidateTimezone: "Europe/Lisbon",
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
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Running",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:15:00Z"),
      candidateKind: "running" as const,
      candidateTimezone: "Europe/Lisbon",
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
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Running",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:05:00Z"),
      candidateKind: "running",
      candidateTimezone: "Europe/Lisbon",
    })).toBe(0);
  });

  it("falls back to title matching when either kind is other", () => {
    const input = {
      sourceTitle: "Knitting",
      sourceMeasure: "minutes",
      sourceEmoji: "🧶",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceKind: "other" as const,
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Knitting",
      candidateMeasure: "minutes",
      candidateEmoji: "🧶",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateKind: "other" as const,
      candidateTimezone: "Europe/Lisbon",
    };

    expect(scoreSharedActivityCandidate(input)).toBeGreaterThanOrEqual(50);
  });

  it("rejects precise locations that are too far apart", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceTimezone: "Europe/Lisbon",
      sourceLatitude: 38.7223,
      sourceLongitude: -9.1393,
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateTimezone: "Europe/Berlin",
      candidateLatitude: 52.52,
      candidateLongitude: 13.405,
    })).toBe(0);
  });

  it("matches nearby precise locations", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceTimezone: "Europe/Lisbon",
      sourceLatitude: 38.7223,
      sourceLongitude: -9.1393,
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateTimezone: "Europe/Lisbon",
      candidateLatitude: 38.7369,
      candidateLongitude: -9.1427,
    })).toBeGreaterThanOrEqual(50);
  });

  it("rejects timezone mismatches when precise location is unavailable", () => {
    expect(scoreSharedActivityCandidate({
      sourceTitle: "Run",
      sourceMeasure: "km",
      sourceEmoji: "🏃",
      sourceDatetime: new Date("2026-05-06T10:00:00Z"),
      sourceTimezone: "Europe/Lisbon",
      candidateTitle: "Run",
      candidateMeasure: "km",
      candidateEmoji: "🏃",
      candidateDatetime: new Date("2026-05-06T10:10:00Z"),
      candidateTimezone: "Europe/Berlin",
    })).toBe(0);
  });
});
