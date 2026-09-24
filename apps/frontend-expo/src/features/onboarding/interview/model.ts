import type {
  OnboardingDraft,
  InterviewFacts,
  InterviewStage,
  InterviewState,
  InterviewResult,
} from "@tsw/prisma/follow-through";
export const stages: InterviewStage[] = ["goal", "baseline", "motivation", "rhythm", "support", "review"];
export const baselineQuestion = {
  title: "Where are you starting?",
  purpose: "What does this look like for you today? Even ‘starting from scratch’ helps.",
  options: [],
};
function startingPointQuestion(goal: string) {
  return /\brun\b|marathon/i.test(goal)
    ? {
        title: "How much do you run now?",
        purpose: "A recent run or your weekly pattern is enough. ‘I haven’t started’ is useful too.",
        options: [],
      }
    : baselineQuestion;
}
export const motivationQuestion = {
  title: "Why does this matter to you?",
  purpose: "A reason makes it easier to return when life gets in the way. You can skip this.",
  options: [],
};
export const weeklyFrequencyQuestionTitle =
  "How many times per week should this plan support?";
export const weeklyFrequencyQuestion = {
  title: weeklyFrequencyQuestionTitle,
  purpose:
    "Set the weekly cadence. The plan can vary the structure and duration of each session later.",
  options: [],
};
export const stageLabels = {
  goal: "Your goal",
  // Kept for drafts created by the previous five-step flow. New onboarding
  // never enters this stage.
  baseline: "Starting point",
  motivation: "Why it matters",
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
      purpose: "Tell me the outcome you want. We’ll ask where you are now and why it matters on the next two screens.",
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
    stage: "baseline",
    question: startingPointQuestion(answer),
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

export function acceptContext(state: InterviewState, answer: string): InterviewState {
  const isBaseline = state.stage === "baseline";
  const stage = isBaseline ? "baseline" : "motivation";
  return {
    ...state,
    stage: isBaseline ? "motivation" : "rhythm",
    question: isBaseline ? motivationQuestion : weeklyFrequencyQuestion,
    turns: [...state.turns, {
      stage,
      question: state.question.title,
      answer,
      feedback: answer ? "Relevant context confirmed by Jev." : "Skipped for now.",
      accepted: true,
    }],
    facts: { ...state.facts, [isBaseline ? "baseline" : "goalReason"]: answer.trim() },
    confirmed: [...new Set<InterviewStage>([...state.confirmed, stage])],
    pending: undefined,
  };
}

export function normalizeInterviewState(state: InterviewState): InterviewState {
  // Drafts from the old flow may have a generated baseline question.
  if (state.stage !== "baseline") return state;
  return { ...state, question: startingPointQuestion(state.facts.goal), pending: undefined };
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
    coachingRole,
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

export function reopenInterviewStage(
  state: InterviewState,
  stage: InterviewStage,
  question: InterviewState["question"] = state.question,
): InterviewState {
  const order: InterviewStage[] = [
    "goal",
    "baseline",
    "motivation",
    "rhythm",
    "support",
    "review",
  ];
  const stageIndex = order.indexOf(stage);
  return {
    ...state,
    stage,
    question,
    pending: undefined,
    turns: state.turns.filter((turn) => order.indexOf(turn.stage) < stageIndex),
    confirmed: state.confirmed.filter(
      (confirmed) => order.indexOf(confirmed) < stageIndex,
    ),
  };
}
