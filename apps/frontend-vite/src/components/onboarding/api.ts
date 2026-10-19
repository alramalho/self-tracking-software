import type {
  FollowThroughSnapshot,
  GoalGuidanceResult,
  OnboardingDraft,
  PlanDesign,
  SubgoalQuestion,
} from "@tsw/prisma/follow-through";
import api from "@/lib/api";
import type { ClassifyResponse, CoachingOffer, CoachingPlan, OptionsResponse, QuestionStage } from "./types";

// The same endpoints the native onboarding uses.

export const loadDraft = async () =>
  (await api.get<FollowThroughSnapshot>("/follow-through")).data.state.draft;

export const saveDraft = async (draft: OnboardingDraft) => {
  await api.put("/follow-through/onboarding/draft", draft);
};

export const checkAnswer = async (stage: QuestionStage, answer: string, goal?: string) =>
  (
    await api.post<GoalGuidanceResult>("/follow-through/onboarding/goal-guidance", {
      step: stage,
      answer,
      goal: goal || undefined,
    })
  ).data;

export const classifyGoal = async (goal: string) =>
  (await api.post<ClassifyResponse>("/follow-through/onboarding/design/classify", { goal }, { timeout: 90000 })).data;

export const nextSubgoal = async (design: PlanDesign, goal: string, baseline: string) =>
  (
    await api.post<{ question: SubgoalQuestion | null }>(
      "/follow-through/onboarding/design/subgoal",
      {
        goal,
        orientation: design.orientation,
        goalSpec: design.goalSpec,
        activity: { title: design.activities[0].title, measure: design.activities[0].measure },
        baseline,
        asked: design.asked,
      },
      { timeout: 90000 },
    )
  ).data.question;

export const designRoutes = async (design: PlanDesign, goal: string, timezone: string) =>
  (
    await api.post<OptionsResponse>(
      "/follow-through/onboarding/design/options",
      {
        goal,
        goalSpec: design.goalSpec,
        baseline: design.baseline.text,
        activities: design.activities,
        preferredDays: design.preferredDays,
        fixedDate: design.fixedDate,
        asked: design.asked,
        timezone,
      },
      { timeout: 180000 },
    )
  ).data;

export const coachingPlans = async (): Promise<CoachingPlan[]> => {
  const offer = (await api.get<CoachingOffer>("/follow-through/onboarding/offer")).data;
  return offer.plans ?? [{ ...offer, id: "monthly" }];
};

export const finishOnboarding = async (request: { draft: OnboardingDraft; preferences: unknown }) =>
  (await api.post<{ planId: string }>("/follow-through/onboarding/finish", request)).data;

/** Where the person is, for the "onboarding dropped" alert. Best effort: never blocks a step. */
export const reportProgress = (draft: OnboardingDraft, step: string, label: string, index: number, total: number) =>
  api
    .post("/onboarding/progress", {
      snapshotVersion: 2,
      currentStep: step,
      currentStepLabel: label,
      currentStepIndex: Math.round(index),
      totalSteps: total,
      completedSteps: [],
      selections: {
        planId: draft.id,
        planGoal: draft.goal || null,
        planGoalReason: draft.interview?.facts.goalReason || null,
        planEmoji: draft.emoji,
        planTimesPerWeek: draft.frequency,
        wantsCoaching: draft.wantsCoaching,
      },
    })
    .catch(() => {});

/** The account's subscription, read fresh: a return from checkout is not proof of payment. */
export const currentPlanType = async () => (await api.get<{ planType?: string | null }>("/users/user")).data.planType ?? "FREE";

export const saveAiConsent = async (granted: boolean) => {
  await api.put("/users/ai-consent", { granted });
};

/** Readable text for a failed request, from the server's own message when it has one. */
export function errorMessage(error: unknown) {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const text = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : null;
  return text ?? (error instanceof Error ? error.message : "Something went wrong. Please try again.");
}
