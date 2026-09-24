import type {
  InterviewResult,
  InterviewState,
} from "@tsw/prisma/follow-through";

function weeklyFrequency(answer: string): number | null {
  const digit = answer.match(/\b([1-7])\b/);
  if (digit) return Number(digit[1]);
  const words = ["one", "two", "three", "four", "five", "six", "seven"];
  const index = words.findIndex((word) =>
    new RegExp(`\\b${word}\\b`, "i").test(answer),
  );
  return index < 0 ? null : index + 1;
}

export function interviewFixture(
  state: InterviewState,
  answer: string,
): InterviewResult {
  const facts = { ...state.facts };
  const running = /half marathon/i.test(facts.goal);
  const chosenFrequency =
    state.stage === "rhythm" ? weeklyFrequency(answer) : null;
  const rejected =
    /asdf|ignore.*instructions|bullshit|be better|seven days/i.test(answer) ||
    (state.stage === "rhythm" && chosenFrequency === null);
  const needsImprovement =
    !rejected &&
    state.stage === "goal" &&
    !/because|express|matters|enjoy|love|feel/i.test(answer);
  const questions = {
    goal: {
      title: "Where are you starting?",
      purpose: "Tell us where you are now.",
      options: [],
    },
    baseline: {
      title: "Why does this matter to you?",
      purpose: "A reason helps the coach respond to difficulties.",
      options: [],
    },
    motivation: {
      title: "How many times per week should this plan support?",
      purpose: "Choose a weekly rhythm you can make room for.",
      options: [],
    },
    rhythm: {
      title: "Would you like coaching for this plan?",
      purpose:
        "Coaching can help you shape your practice. You can review it before starting a trial, or simply track this plan for free.",
      options: ["Yes, coach this plan", "No, just track it"],
    },
    support: {
      title: "Does this feel like your plan?",
      purpose:
        "Check what we’ve put together. Tell me if something needs changing.",
      options: [],
    },
    review: {
      title: "Ready to start?",
      purpose: "Choose coaching or free tracking.",
      options: [],
    },
  };
  if (!rejected) {
    if (state.stage === "goal")
      Object.assign(facts, {
        emoji: "🎸",
      });
    if (state.stage === "baseline") facts.baseline = answer;
    if (state.stage === "motivation") facts.goalReason = answer;
    if (chosenFrequency !== null) facts.frequency = chosenFrequency;
    if (state.stage === "support")
      Object.assign(facts, {
        wantsCoaching: answer.trim() !== "No, just track it",
        recommendation: "coaching",
        recommendationReason: "You want help turning chord changes into songs.",
        activityTitle: "Guitar practice",
        measure: "minutes",
        nextStep: answer.trim() === "No, just track it"
          ? "Log your next guitar practice session."
          : "Log your next guitar practice and note what you want help with.",
      });
  }
  // Prepared running example for visual review. This is fixture copy, not a model evaluation.
  if (running && !rejected) {
    Object.assign(facts, {
      emoji: "🏃",
      targetDate: "2027-03-28",
      activityTitle: "Running",
      measure: "kilometers",
      frequency: facts.frequency,
      commitment: "WEEKLY",
      weekdays: [],
      time: null,
      coachingRole: "training",
      recommendation: "coaching",
      recommendationReason:
        "Build from your current running and review how each week feels.",
      nextStep: facts.wantsCoaching
        ? "Agree a first week with your coach before increasing your running."
        : "Log your next run.",
    });
    questions.rhythm = {
      title: "Would you like coaching for this plan?",
      purpose:
        "Coaching can shape your running schedule and propose adjustments. You can review it before starting a trial, or track this plan for free.",
      options: ["Yes, coach this plan", "No, just track it"],
    };
  }
  const question = rejected
    ? {
        title:
          state.stage === "rhythm"
            ? "Three sessions or seven — which fits?"
            : "What is one thing you actually want to practise?",
        purpose: "I need a concrete answer before building your plan.",
        options: [],
      }
    : questions[state.stage];
  return {
    accepted: !rejected,
    needsImprovement,
    summary: rejected
      ? "That doesn’t give me a consistent, actionable answer yet. Let’s clarify it."
      : needsImprovement
        ? "The goal is clear. One useful detail is still optional."
        : "We’ll build around your goal and the time you actually have.",
    checks: [
      {
        label: rejected
          ? "Needs clarification"
          : needsImprovement
            ? "Useful context"
            : "Concrete and consistent",
        required: !needsImprovement,
        passed: !rejected && !needsImprovement,
        detail: rejected
          ? "Please clarify your answer."
          : needsImprovement
            ? "Why it matters is helpful, but not required."
            : "This fits what you told me.",
      },
    ],
    facts,
    question,
    nextQuestion: question,
  };
}
