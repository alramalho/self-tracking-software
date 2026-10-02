import { describe, expect, it } from "vitest";
import type { OnboardingDraft } from "@tsw/prisma/follow-through";
import { onboardingReviewEvents } from "./review";

const draft = {
  id: "example-draft",
  interview: {
    facts: { goal: "Run a half marathon" },
    turns: [{ stage: "baseline", question: "Where are you now?", answer: "idk 2 or 3? work changes lol", accepted: true, feedback: "Starting point recorded" }],
  },
} as OnboardingDraft;

describe("onboarding review history", () => {
  it("keeps the submitted wording and interpretation together, without repeating an unchanged save", () => {
    const events = onboardingReviewEvents("user-1", draft);
    expect(events[0]).toMatchObject({ draftId: "example-draft", answer: "idk 2 or 3? work changes lol", accepted: true, facts: { goal: "Run a half marathon" } });
    expect(onboardingReviewEvents("user-1", structuredClone(draft), draft)).toEqual([]);
    expect(onboardingReviewEvents("user-1", draft)[0].eventId).toBe(events[0].eventId);
  });
  it("retains a rejected correction as a new reviewable event", () => {
    const corrected = structuredClone(draft);
    corrected.interview!.turns[0] = { ...corrected.interview!.turns[0], answer: "actually just saturday", accepted: false, feedback: "Change the three-day target?" };
    const [event] = onboardingReviewEvents("user-1", corrected, draft);
    expect(event).toMatchObject({ answer: "actually just saturday", accepted: false, turnIndex: 0 });
    expect(event.eventId).not.toBe(onboardingReviewEvents("user-1", draft)[0].eventId);
  });
  it("keeps separate attempts separate even when someone reuses the same wording", () => {
    const another = { ...draft, id: "new-attempt" };
    expect(onboardingReviewEvents("user-1", another, draft)).toHaveLength(1);
  });
});
