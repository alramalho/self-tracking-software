import { describe, expect, it } from "vitest";
import { onboardingReach } from "./funnel";
import { canSeeAnalytics } from "./people";
import { heardAs, summarizeVoice } from "./voiceNotes";

describe("onboardingReach", () => {
  it("counts a person with no draft as signed up only", () => {
    expect(onboardingReach(undefined)).toBe(0);
  });
  it("puts someone on the motivation question past goal and baseline", () => {
    expect(onboardingReach({ step: "interview", interview: { stage: "motivation" } })).toBe(2);
  });
  it("puts the coach tour at the stage it was opened from", () => {
    expect(onboardingReach({ step: "coaching-tour-1", interview: { stage: "review" } })).toBe(5);
  });
  it("puts plan review, confidence and the paywall at the end step", () => {
    expect(onboardingReach({ step: "interview-finish", interview: { stage: "review" } })).toBe(6);
    expect(onboardingReach({ step: "confidence" })).toBe(6);
    expect(onboardingReach({ step: "interview", awaitingUpgrade: true })).toBe(6);
  });
});

describe("canSeeAnalytics", () => {
  const env = { ANALYTICS_EMAILS: "Owner@Example.com, other@example.com" } as NodeJS.ProcessEnv;
  it("lets in listed emails, case-insensitive", () => {
    expect(canSeeAnalytics("owner@example.com", env)).toBe(true);
  });
  it("keeps everyone else out, and everyone when unset", () => {
    expect(canSeeAnalytics("someone@example.com", env)).toBe(false);
    expect(canSeeAnalytics("owner@example.com", {} as NodeJS.ProcessEnv)).toBe(false);
    expect(canSeeAnalytics(null, env)).toBe(false);
  });
});

describe("summarizeVoice", () => {
  const catalog = [{ activityId: "a1", title: "Running", measure: "km" }];
  it("marks a note kept when a commit followed and counts per day", () => {
    const summary = summarizeVoice([
      { at: "2026-11-18T08:00:00Z", kind: "preview", userId: "u", clientRequestId: "r1", catalog, extraction: { activities: [{ activityId: "a1", quantity: 5 }] } },
      { at: "2026-11-18T08:01:00Z", kind: "commit", userId: "u", clientRequestId: "r1" },
      { at: "2026-11-18T09:00:00Z", kind: "preview", userId: "u", clientRequestId: "r2" },
      { at: "2026-11-18T09:01:00Z", kind: "refinement", userId: "u", clientRequestId: "r2" },
    ]);
    expect(summary.notes).toHaveLength(2);
    expect(summary.perDay.get("2026-11-18")).toEqual({ kept: 1, dropped: 1 });
    expect(heardAs(summary.notes[0])).toEqual(["Running 5 km"]);
  });
});
