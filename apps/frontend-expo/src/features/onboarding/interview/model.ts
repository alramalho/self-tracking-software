import type {
  OnboardingDraft,
  InterviewFacts,
  InterviewStage,
  InterviewState,
  InterviewResult,
} from "@tsw/prisma/follow-through";
export const stages: InterviewStage[] = ["goal", "rhythm", "support", "review"];
export const stageLabels = {
  goal: "Your goal",
  // Kept for drafts created by the previous five-step flow. New onboarding
  // never enters this stage.
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
      // Production still validates this legacy field. It is only the default timer
      // setting and is not presented as a duration prescription during onboarding.
      durationMinutes: draft.durationMinutes,
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

export function acceptGoal(
  state: InterviewState,
  answer: string,
): InterviewState {
  return {
    ...state,
    stage: "rhythm",
    question: {
      title: "How many times per week should this plan support?",
      purpose:
        "Set the weekly cadence. The plan can vary the structure and duration of each session later.",
      options: ["2 sessions a week", "3 sessions a week", "4 sessions a week"],
    },
    turns: [
      ...state.turns,
      {
        stage: "goal",
        question: state.question.title,
        answer,
        feedback: "Jev confirmed that the goal is clear enough to continue.",
        accepted: true,
      },
    ],
    facts: { ...state.facts, goal: answer.trim() },
    confirmed: Array.from(
      new Set<InterviewStage>([...state.confirmed, "goal"]),
    ),
    pending: undefined,
  };
}

export function normalizeInterviewState(state: InterviewState): InterviewState {
  if (state.stage !== "baseline") return state;
  return {
    ...state,
    stage: "rhythm",
    question: {
      title: "How many times per week should this plan support?",
      purpose:
        "Set the weekly cadence. The plan can vary the structure and duration of each session later.",
      options: ["2 sessions a week", "3 sessions a week", "4 sessions a week"],
    },
    confirmed: state.confirmed.filter((value) => value !== "baseline"),
    pending: undefined,
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
    // Older production servers still accept this transport field. It must not
    // leak into the operational draft as a plan-level fact.
    durationMinutes: _legacyDurationMinutes,
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
