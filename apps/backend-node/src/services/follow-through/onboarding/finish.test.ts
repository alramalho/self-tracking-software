import { describe, expect, it } from "vitest";
import type {
  OnboardingDraft,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import { finalOnboardingChoice } from "./finish";

const preferences: SupportPreferences = {
  coaching: true,
  reminder: true,
  reminderMinutes: 15,
  dayReminderTime: "08:00",
  checkIn: true,
  checkInTime: "18:00",
  weeklyReview: true,
  reviewDay: 0,
  reviewTime: "18:00",
};

function coachedDraft(nextStep: string): OnboardingDraft {
  return {
    id: "5a46b61c-a75d-45d5-8a56-28c20aa4d684",
    goal: "Run a half marathon",
    emoji: "🏃",
    activityId: null,
    activityTitle: "Running",
    measure: "kilometers",
    commitment: "WEEKLY",
    frequency: 3,
    weekdays: [],
    time: null,
    durationMinutes: 20,
    timezone: "Europe/Lisbon",
    targetDate: null,
    resourceName: "",
    resourceUrl: "",
    nextStep,
    format: "LOG",
    wantsCoaching: true,
    answers: [
      {
        question: "How many times per week?",
        answer: "3",
        use: "A flexible weekly target.",
      },
      {
        question: "Would you like coaching for this plan?",
        answer: "Yes, coach this plan",
        use: "The coach will prepare a first week.",
      },
    ],
    step: "review",
    createdPlanId: null,
    awaitingUpgrade: true,
    coaching: {
      role: "training",
      followUps: true,
      dataAccess: { workouts: true, sleep: true },
    },
    interview: {
      version: 1,
      stage: "review",
      question: { title: "Ready?", purpose: "", options: [] },
      turns: [
        {
          stage: "rhythm",
          question: "How many times per week?",
          answer: "3",
          feedback: "A flexible weekly target.",
          accepted: true,
        },
        {
          stage: "support",
          question: "Would you like coaching for this plan?",
          answer: "Yes, coach this plan",
          feedback: "The coach will prepare a first week.",
          accepted: true,
        },
      ],
      confirmed: ["goal", "rhythm", "support"],
      facts: {
        goal: "Run a half marathon",
        goalReason: "Finish with friends",
        baseline: "Two easy runs a week",
        emoji: "🏃",
        activityTitle: "Running",
        measure: "kilometers",
        frequency: 3,
        commitment: "WEEKLY",
        weekdays: [],
        time: null,
        targetDate: null,
        resourceName: "",
        resourceUrl: "",
        nextStep,
        recommendation: "coaching",
        coachingRole: "training",
        recommendationReason: "You asked for a training schedule.",
        wantsCoaching: true,
      },
    },
  };
}

describe("final onboarding choice", () => {
  it("saves a declined trial as free tracking with an independent first step", () => {
    const draft = coachedDraft(
      "Agree a first week with your coach before increasing your running.",
    );
    const choice = finalOnboardingChoice(draft, {
      ...preferences,
      coaching: false,
    });

    expect(choice.draft.nextStep).toBe("Log your next running session.");
    expect(choice.draft.interview?.facts.nextStep).toBe(choice.draft.nextStep);
    expect(choice.draft.wantsCoaching).toBe(false);
    expect(choice.draft.interview?.facts.wantsCoaching).toBe(false);
    expect(choice.draft.interview?.facts.coachingRole).toBeUndefined();
    expect(choice.draft.answers).toEqual([draft.answers[0]]);
    expect(choice.draft.interview?.turns).toEqual([draft.interview?.turns[0]]);
    expect(JSON.stringify(choice.draft.answers)).not.toMatch(/coach/i);
    expect(choice.draft.coaching).toEqual({
      role: "tracking",
      followUps: false,
      dataAccess: { workouts: false, sleep: false },
    });
    expect(choice.draft.awaitingUpgrade).toBe(false);
    expect(choice.preferences).toMatchObject({
      coaching: false,
      checkIn: false,
      weeklyReview: false,
    });
    expect(choice.draft.preferences).toEqual(choice.preferences);
    expect(draft.wantsCoaching).toBe(true);
  });

  it("keeps an independent first step when the person chooses free tracking", () => {
    const draft = coachedDraft("Log your next easy run.");
    const choice = finalOnboardingChoice(draft, {
      ...preferences,
      coaching: false,
    });
    expect(choice.draft.nextStep).toBe("Log your next easy run.");
  });
});
