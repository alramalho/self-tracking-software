import type {
  OnboardingDraft,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import { independentTrackingStep } from "./next-step";

function choiceKey(question: string, answer: string) {
  return `${question}\u0000${answer}`;
}

function supersededCoachingChoice(answer: string) {
  return /^(?:yes,\s*coach this plan|help me shape a plan|no,\s*just track it|i know my plan\s*[-\u2013\u2014]\s*just tracking)$/i.test(
    answer.trim(),
  );
}

export function finalOnboardingChoice(
  draft: OnboardingDraft,
  preferences: SupportPreferences,
) {
  if (preferences.coaching) return { draft, preferences };

  const freePreferences = {
    ...preferences,
    coaching: false,
    checkIn: false,
    weeklyReview: false,
  };
  const nextStep = independentTrackingStep(draft.activityTitle, draft.nextStep);
  const supersededTurns =
    draft.interview?.turns.filter(
      (turn) =>
        turn.stage === "support" ||
        (turn.stage === "review" && /\bcoach(?:ing)?\b/i.test(turn.answer)),
    ) ?? [];
  const supersededKeys = new Set(
    supersededTurns.map((turn) => choiceKey(turn.question, turn.answer)),
  );
  const answers = draft.answers.filter(
    (answer) =>
      !supersededKeys.has(choiceKey(answer.question, answer.answer)) &&
      !supersededCoachingChoice(answer.answer),
  );
  const interview = draft.interview
    ? {
        ...draft.interview,
        turns: draft.interview.turns.filter(
          (turn) => !supersededKeys.has(choiceKey(turn.question, turn.answer)),
        ),
        facts: {
          ...draft.interview.facts,
          wantsCoaching: false,
          coachingRole: undefined,
          nextStep,
        },
        pending: undefined,
      }
    : undefined;
  return {
    draft: {
      ...draft,
      wantsCoaching: false,
      awaitingUpgrade: false,
      nextStep,
      answers,
      coaching: {
        role: "tracking" as const,
        followUps: false,
        dataAccess: { workouts: false, sleep: false },
      },
      interview,
      preferences: freePreferences,
    },
    preferences: freePreferences,
  };
}
