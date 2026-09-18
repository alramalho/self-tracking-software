import type {
  OnboardingDraft,
  InterviewFacts,
  InterviewStage,
  InterviewState,
  InterviewResult,
} from "@tsw/prisma/follow-through";
export const stages: InterviewStage[] = [
  "goal",
  "baseline",
  "rhythm",
  "support",
  "review",
];
export const stageLabels = {
  goal: "Your goal",
  baseline: "Starting point",
  rhythm: "Your week",
  support: "Your support",
  review: "Your plan",
};
export function startInterview(draft: OnboardingDraft): InterviewState {
  return {
    version: 1,
    stage: "goal",
    confirmed: [],
    turns: [],
    question: {
      title: "What do you want to achieve?",
      purpose:
        "Tell me what you have in mind and why it matters to you. We’ll shape the plan together.",
      options: [],
    },
    facts: {
      goal: draft.goal,
      goalReason: "",
      baseline: "",
      emoji: draft.emoji,
      activityTitle: draft.activityTitle,
      measure: draft.measure,
      frequency: draft.frequency,
      commitment: draft.commitment,
      weekdays: draft.weekdays,
      time: draft.time,
      targetDate: draft.targetDate,
      resourceName: draft.resourceName,
      resourceUrl: draft.resourceUrl,
      nextStep: draft.nextStep,
      recommendation: "tracking",
      recommendationReason: "",
      wantsCoaching: draft.wantsCoaching,
    },
  };
}
export function applyFacts(
  draft: OnboardingDraft,
  facts: InterviewFacts,
): OnboardingDraft {
  const {
    goalReason,
    baseline,
    recommendation,
    recommendationReason,
    ...fields
  } = facts;
  return {
    ...draft,
    ...fields,
    activityId:
      fields.activityTitle === draft.activityTitle &&
      fields.measure === draft.measure
        ? draft.activityId
        : null,
    format: fields.resourceUrl ? "RESOURCE" : "LOG",
  };
}
export function recordTurn(
  state: InterviewState,
  answer: string,
  result: InterviewResult,
): InterviewState {
  return {
    ...state,
    pending: undefined,
    turns: [
      ...state.turns,
      {
        stage: state.stage,
        question: state.question.title,
        answer,
        feedback: result.summary,
        accepted: result.accepted,
      },
    ],
    // Unaccepted extraction remains a suggestion; the conversation retains it for clarification.
    facts: result.accepted ? result.facts : state.facts,
    question: result.accepted ? state.question : result.question,
  };
}
export function nextStage(
  state: InterviewState,
  result: InterviewResult,
): InterviewState {
  return {
    ...state,
    stage: stages[Math.min(stages.length - 1, stages.indexOf(state.stage) + 1)],
    question: result.nextQuestion,
    confirmed: [...new Set([...state.confirmed, state.stage])],
  };
}
