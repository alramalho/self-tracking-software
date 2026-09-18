/** Gateway smoke check using the user's examples. No accounts, plans or messages are written. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { nextQuestion } from "../../src/services/follow-through/onboarding/service";
import { nextSchema } from "../../src/services/follow-through/onboarding/schema";
import type { OnboardingDraft } from "@tsw/prisma/follow-through";
async function main() {
  const base: OnboardingDraft = {
    id: randomUUID(),
    goal: "",
    emoji: "🎯",
    activityId: null,
    activityTitle: "",
    measure: "minutes",
    commitment: "WEEKLY",
    frequency: 4,
    weekdays: [],
    time: null,
    durationMinutes: 30,
    timezone: "Europe/Lisbon",
    targetDate: null,
    resourceName: "",
    resourceUrl: "",
    nextStep: "",
    format: "LOG",
    wantsCoaching: true,
    answers: [],
    step: "followup",
    createdPlanId: null,
  };
  const cases = [
    {
      name: "Guitar alongside Pickup Music",
      draft: {
        ...base,
        goal: "Write my own guitar songs and transfer melodies in my head to guitar",
        activityTitle: "Guitar",
        resourceName: "Pickup Music",
        resourceUrl: "https://www.pickupmusic.com",
      },
      answer:
        "I can play chords, but finding melodies by ear is hard. I already have a course exercise bookmarked.",
    },
    {
      name: "Half marathon alongside existing training",
      draft: {
        ...base,
        goal: "Prepare for a half marathon on November 29",
        activityTitle: "Running",
        targetDate: "2026-11-29",
        durationMinutes: 45,
      },
      answer:
        "I exercise four days a week but have not picked a running plan. I want to keep my two strength sessions and choose a suitable training plan first.",
    },
    {
      name: "Short weekday meditation",
      draft: {
        ...base,
        goal: "Make meditation a regular part of my workday",
        activityTitle: "Meditation",
        durationMinutes: 10,
        frequency: 3,
      },
      answer:
        "After lunch is a reliable opening. I know a breathing practice already, but forget to start.",
    },
  ];
  for (const item of cases) {
    const first = nextSchema.parse(await nextQuestion(item.draft));
    assert.ok(first.ready || first.question?.title);
    assert.ok(first.suggestedFormat !== "RESOURCE" || item.draft.resourceUrl);
    const draft = {
      ...item.draft,
      answers: first.question
        ? [
            {
              question: first.question.title,
              answer: item.answer,
              use: first.question.purpose,
            },
            {
              question: "When is there room?",
              answer: "I can use the time and days I chose.",
              use: "Keep the agreed commitment",
            },
            {
              question: "What makes starting easier?",
              answer: "Prepare the resource before the session.",
              use: "Choose a concrete first action",
            },
          ]
        : [],
    };
    const final = nextSchema.parse(await nextQuestion(draft));
    assert.equal(final.ready, true);
    assert.equal(final.question, null);
    assert.ok(final.nextStep.trim());
    assert.ok(final.suggestedFormat !== "RESOURCE" || draft.resourceUrl);
    console.log(JSON.stringify({ case: item.name, first, final }));
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Gateway check failed",
    );
    process.exit(1);
  });
