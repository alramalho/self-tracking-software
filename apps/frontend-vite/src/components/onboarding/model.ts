import type {
  DesignBaseline,
  GoalGuidanceResult,
  InterviewStage,
  InterviewState,
  OnboardingCircleChoice,
  OnboardingDraft,
  PlanCoaching,
  PlanDesign,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import type { ClassifyResponse, OnboardingFlowKind, OnboardingProgress, OnboardingScreen, QuestionStage } from "./types";

// The same rules as the native app (apps/frontend-expo/src/features/onboarding), kept
// in one place here. Drafts are shared through the server, so field names and step
// names must stay identical on both platforms.

/** Goal, starting point, why, 3 design screens, 3 coach screens, circle, match, plan. */
export const TOTAL_STEPS = 12;

export const newDraft = (id: string, goal = ""): OnboardingDraft => ({
  id,
  goal,
  emoji: "🎯",
  activityId: null,
  activityTitle: "",
  measure: "sessions",
  commitment: "WEEKLY",
  frequency: 3,
  weekdays: [],
  time: null,
  durationMinutes: 20,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  targetDate: null,
  resourceName: "",
  resourceUrl: "",
  nextStep: "",
  format: "LOG",
  wantsCoaching: false,
  answers: [],
  step: "goal",
  createdPlanId: null,
});

export const initialCoaching = (): PlanCoaching => ({
  role: "tracking",
  followUps: false,
  dataAccess: { workouts: false, sleep: false },
});

export function onboardingPreferences(draft: OnboardingDraft): SupportPreferences {
  return (
    draft.preferences ?? {
      coaching: draft.wantsCoaching,
      reminder: false,
      reminderMinutes: 30,
      dayReminderTime: "09:00",
      checkIn: false,
      checkInTime: "10:00",
      weeklyReview: false,
      reviewDay: 0,
      reviewTime: "18:00",
    }
  );
}

// ── Onboarding or creating a plan in the app ────────────────────────────────

/** A fresh start opens on the welcome; a goal passed in, or creating a plan inside the app, skips it. */
export const showsWelcome = (goal: string, flow: OnboardingFlowKind) => !goal && flow !== "create";

/** Close returns to the plans when creating one; new members can't leave onboarding. */
export function closeTarget(flow: OnboardingFlowKind, onboarded: boolean): "/plans" | "/" | null {
  if (flow === "create") return "/plans";
  return onboarded ? "/" : null;
}

// ── The three questions ─────────────────────────────────────────────────────

const questionTitles: Record<QuestionStage, string> = {
  goal: "What's your goal?",
  baseline: "Where are you now?",
  motivation: "Why does it matter?",
};

const question = (title: string) => ({ title, purpose: "", options: [] });

export function startInterview(draft: OnboardingDraft): InterviewState {
  return {
    version: 1,
    stage: "goal",
    confirmed: [],
    turns: [],
    question: question(questionTitles.goal),
    facts: {
      goal: draft.goal,
      goalReason: "",
      baseline: "",
      emoji: draft.emoji,
      activityTitle: draft.activityTitle,
      measure: draft.measure,
      frequency: draft.frequency,
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

const confirm = (state: InterviewState, stage: InterviewStage) => [...new Set<InterviewStage>([...state.confirmed, stage])];

/** The coach has read the goal and chosen the starting-point question that fits it. */
export function acceptGoal(state: InterviewState, answer: string, baselineTitle: string): InterviewState {
  return {
    ...state,
    stage: "baseline",
    question: question(baselineTitle || questionTitles.baseline),
    turns: [
      ...state.turns.filter((turn) => turn.stage !== "goal"),
      { stage: "goal", question: state.question.title, answer, feedback: "The goal is clear enough to continue.", accepted: true },
    ],
    facts: { ...state.facts, goal: answer.trim() },
    confirmed: confirm(state, "goal"),
    pending: undefined,
  };
}

/** Starting point and why it matters: kept as written. An empty answer means skipped. */
export function acceptContext(state: InterviewState, answer: string): InterviewState {
  const baseline = state.stage === "baseline";
  const stage: InterviewStage = baseline ? "baseline" : "motivation";
  return {
    ...state,
    stage: baseline ? "motivation" : "rhythm",
    question: question(baseline ? questionTitles.motivation : "How many times a week?"),
    turns: [
      ...state.turns.filter((turn) => turn.stage !== stage),
      { stage, question: state.question.title, answer, feedback: answer ? "Relevant context." : "Skipped for now.", accepted: true },
    ],
    facts: { ...state.facts, [baseline ? "baseline" : "goalReason"]: answer.trim() },
    confirmed: confirm(state, stage),
    pending: undefined,
  };
}

const order: InterviewStage[] = ["goal", "baseline", "motivation", "rhythm", "support", "review"];

/** Going back: the earlier stage is open again, and later stages are no longer confirmed. */
export function reopenStage(state: InterviewState, stage: InterviewStage): InterviewState {
  const index = order.indexOf(stage);
  const asked = [...state.turns].reverse().find((turn) => turn.stage === stage)?.question;
  return {
    ...state,
    stage,
    question: question(asked ?? questionTitles[stage as QuestionStage] ?? ""),
    pending: undefined,
    confirmed: state.confirmed.filter((done) => order.indexOf(done) < index),
  };
}

/** What the person wrote last time for this question, so going back keeps it. */
export const previousAnswer = (state: InterviewState, stage: InterviewStage) =>
  [...state.turns].reverse().find((turn) => turn.stage === stage)?.answer ?? "";

export const answersOf = (state: InterviewState) =>
  state.turns.map((turn) => ({ question: turn.question, answer: turn.answer, use: turn.feedback.slice(0, 400) }));

/** Outcome goals need a starting point to plan from; a habit's starting point can be skipped. */
export const canSkipQuestion = (stage: QuestionStage, design?: PlanDesign) =>
  stage === "motivation" || (stage === "baseline" && design?.orientation !== "OUTCOME");

// ── The answer check under each question ────────────────────────────────────

export const guidanceStep = (stage: QuestionStage) => stage;

export function initialGuidance(stage: QuestionStage): GoalGuidanceResult {
  return {
    requirements: [
      {
        key: stage,
        label: stage === "goal" ? "A clear target" : stage === "baseline" ? "Starting point" : "Personal reason",
        phrase: stage === "goal" ? "Say what you want to achieve." : stage === "baseline" ? "Say where you are now." : "Say why this matters to you.",
        required: stage === "goal",
        passed: false,
        detail: stage === "goal" ? "Name the outcome you want to work towards." : "You can skip this step.",
      },
    ],
  };
}

export function guidanceFor(result: GoalGuidanceResult, stage: QuestionStage): GoalGuidanceResult {
  const matched = result.requirements.find(
    (item) => item.key === stage || (stage === "baseline" && item.key === "starting-point"),
  );
  return matched ? { requirements: [{ ...matched, key: stage }] } : initialGuidance(stage);
}

export const guidancePassed = (result: GoalGuidanceResult, stage: QuestionStage) =>
  !!result.requirements[0]?.passed && result.requirements[0]?.key === stage;

/** The numbers measured from their logs stay attached only while the text is still the one we suggested. */
export const baselineFrom = (text: string, logged: DesignBaseline | null): DesignBaseline => ({
  text: text.trim(),
  measurements: logged && logged.text === text.trim() ? logged.measurements : [],
});

// ── The coach's design ──────────────────────────────────────────────────────

export function initialDesign(classified: ClassifyResponse, baseline: string, weeklyDefault: number): PlanDesign {
  return {
    orientation: classified.orientation,
    goalSpec: classified.goalSpec,
    baseline: { text: baseline, measurements: [] },
    activities: [classified.activity],
    preferredDays: weeklyDefault,
    coachNote: null,
    fixedDate: null,
    asked: [],
    options: [],
    selected: null,
    startDate: new Date().toISOString().slice(0, 10),
  };
}

/** Everything the plan needs once a route (or a weekly target) is chosen. */
export function designedFacts(design: PlanDesign) {
  const activity = design.activities[0];
  const route = design.options.find((option) => option.id === design.selected);
  const first = route?.sessions[0];
  const outcome = design.orientation === "OUTCOME";
  return {
    emoji: activity.emoji,
    activityTitle: activity.title,
    measure: activity.measure,
    // The weekly target is the low end of the range.
    frequency: route?.daysMin ?? design.preferredDays,
    commitment: "WEEKLY" as const,
    weekdays: [] as number[],
    time: null,
    targetDate: outcome ? (route?.finishingDate ?? null) : null,
    nextStep: first
      ? `${first.title}: ${first.quantity} ${activity.measure} on ${first.date}.`
      : `Log your next ${activity.title.toLowerCase()} session.`,
    recommendation: "coaching" as const,
    coachingRole: outcome ? ("training" as const) : ("consistency" as const),
    recommendationReason: "",
    wantsCoaching: true,
  };
}

/** The draft's plan fields follow the interview facts (the reason and starting point stay in the interview). */
export function applyFacts(draft: OnboardingDraft, facts: ReturnType<typeof designedFacts>): OnboardingDraft {
  return {
    ...draft,
    ...facts,
    activityId: facts.activityTitle === draft.activityTitle && facts.measure === draft.measure ? draft.activityId : null,
    format: "LOG",
  };
}

/** The route chosen names the coach. A habit has no route, so it is the account's coach. */
export function coachOf(design: PlanDesign | undefined, accountCoach: "Helly" | "Oli"): "Helly" | "Oli" {
  const route = design?.options.find((option) => option.id === design.selected);
  return route?.coach ?? accountCoach;
}

// ── Where a saved draft resumes ─────────────────────────────────────────────

/** Drafts from the old interview (no design past the questions) start again from their goal. */
export function isResumable(draft: OnboardingDraft): boolean {
  if (draft.createdPlanId) return false;
  const stage = draft.interview?.stage ?? "goal";
  return ["goal", "baseline", "motivation"].includes(stage) || !!draft.design;
}

export function screenFor(draft: OnboardingDraft): OnboardingScreen {
  const stage = draft.interview?.stage ?? "goal";
  if (draft.step === "interview-finish") return { name: "paywall" };
  if (draft.step === "confidence") return { name: "confidence" };
  const tour = /^coaching-tour-([0-2])$/.exec(draft.step);
  if (tour) return { name: "coach", step: Number(tour[1]) };
  if (stage === "goal" || stage === "baseline" || stage === "motivation") return { name: "question", stage };
  if (stage === "rhythm") return { name: "design" };
  // The plan is chosen and the coach introduced: the circle, then how sure they are.
  return draft.circle ? { name: "confidence" } : { name: "circle" };
}

export function progressFor(screen: OnboardingScreen, matching = false): OnboardingProgress {
  const at = (current: number) => ({ current, total: TOTAL_STEPS });
  switch (screen.name) {
    case "question":
      return at(["goal", "baseline", "motivation"].indexOf(screen.stage) + 1);
    case "design":
      return at(4);
    case "coach":
      return at(7 + screen.step);
    case "circle":
      return at(matching ? 11 : 10);
    case "confidence":
      return at(11.5);
    case "paywall":
      return at(12);
  }
}

// ── Finishing ───────────────────────────────────────────────────────────────

export function finishRequest(draft: OnboardingDraft, coaching: boolean) {
  const preferences = onboardingPreferences(draft);
  return {
    draft: {
      ...draft,
      awaitingUpgrade: false,
      coaching: coaching ? draft.coaching : initialCoaching(),
      wantsCoaching: coaching,
    },
    preferences: {
      ...preferences,
      coaching,
      checkIn: coaching && preferences.checkIn,
      weeklyReview: coaching && preferences.weeklyReview,
    },
  };
}

/** A circle needs the plan, so matching opens right after it is created. */
export const wantsCircle = (circle?: OnboardingCircleChoice) => !!circle && circle.choice !== "solo";
