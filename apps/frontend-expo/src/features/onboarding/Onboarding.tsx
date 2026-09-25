import { useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Pressable, TextInput, View } from "react-native";
import {
  CalendarDays,
  Goal,
  Heart,
  Route,
  Sparkles,
  HeartHandshake,
} from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  OnboardingDraft,
  InterviewResult,
  InterviewStage,
  InterviewState,
  GoalGuidanceResult,
  SupportPreferences,
} from "@tsw/prisma/follow-through";
import { useColors, Status } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { Reveal } from "@/components/reveal/Reveal";
import { EditorButton } from "@/features/activities/editor/controls";
import { useCurrentUser } from "@/data/queries";
import { api } from "@/data/api";
import { goBack } from "@/core/navigation";
import { useFollowThrough } from "@/features/follow-through/api";
import { DictationButton } from "@/features/dictation/DictationButton";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { newDraft } from "./model";
import { InterviewFrame } from "./interview/Frame";
import { WeeklyFrequencyPicker } from "./interview/WeeklyFrequencyPicker";
import { PlanSummary } from "./interview/PlanSummary";
import { onboardingPreferences } from "./preferences";
import { CoachingTour } from "./CoachingTour";
import { PlanConclusion } from "./PlanConclusion";
import { Paywall, paywallCta } from "./Paywall";
import { initialCoaching } from "@/features/plans/coaching/CoachingFields";
import { CoachSuggestion } from "./interview/CoachSuggestion";
import { CoachValidation } from "./interview/CoachValidation";
import { GoalGuidance, guidanceForStage, guidanceStep, initialGoalGuidance } from "./interview/GoalGuidance";
import {
  acceptContext,
  acceptGoal,
  applyFacts,
  normalizeInterviewState,
  nextStage,
  recordTurn,
  reopenInterviewStage,
  stageLabels,
  startInterview,
  stages,
  weeklyFrequencyQuestion,
  weeklyFrequencyQuestionTitle,
} from "./interview/model";
import type { CoachingOffer, CoachingPlan, OnboardingProps } from "./types";

function frequencyFromAnswer(answer: string | undefined, fallback: number) {
  const count = Number.parseInt(answer || "", 10);
  return Number.isInteger(count) && count >= 1 && count <= 7
    ? count
    : fallback;
}

export default function Onboarding({
  preview = false,
  initialGoal,
}: OnboardingProps) {
  const c = useColors(),
    client = useQueryClient(),
    user = useCurrentUser(),
    saved = useFollowThrough(!preview);
  const aiConsent = useAiConsent();
  const [draft, setDraft] = useState(() => ({
    ...newDraft(randomUUID()),
    ...(initialGoal?.trim() ? { goal: initialGoal.trim() } : {}),
  }));
  const [state, setState] = useState<InterviewState>(() =>
    startInterview(draft),
  );
  const [answer, setAnswer] = useState(initialGoal?.trim() ?? "");
  const [weeklyFrequency, setWeeklyFrequency] = useState(draft.frequency);
  const [candidate, setCandidate] = useState<InterviewResult>();
  const [validation, setValidation] = useState<InterviewResult>();
  const [validationReady, setValidationReady] = useState(false);
  const [goalGuidance, setGoalGuidance] =
    useState<GoalGuidanceResult>(() => initialGoalGuidance("goal"));
  const [goalGuidanceBusy, setGoalGuidanceBusy] = useState(false);
  const [history, setHistory] = useState<InterviewState[]>([]);
  const [paywall, setPaywall] = useState(false),
    [finished, setFinished] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [awaitingUpgrade, setAwaitingUpgrade] = useState(false),
    [checking, setChecking] = useState(false);
  // Quarterly is the best value, so it starts selected.
  const [planId, setPlanId] = useState<CoachingPlan["id"]>("quarterly");
  const [error, setError] = useState<unknown>();
  const [dictationBusy, setDictationBusy] = useState(false);
  const upgradeIntent = useRef(false);
  const loaded = useRef(false),
    finishing = useRef(false),
    mounted = useRef(true),
    checkoutOpen = useRef(false),
    guidanceRequest = useRef(0);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  // The interview is run by AI, so ask about AI before it starts.
  const askedAi = useRef(false);
  const askAi = aiConsent.ask;
  useEffect(() => {
    if (!user.data || aiConsent.allowed || askedAi.current) return;
    askedAi.current = true;
    void askAi();
  }, [user.data, aiConsent.allowed, askAi]);
  useEffect(() => {
    if (preview || loaded.current || !saved.data) return;
    loaded.current = true;
    const value = saved.data.state.draft;
    if (!value || value.createdPlanId) return;
    setDraft(value);
    const interview = normalizeInterviewState(
      value.interview || startInterview(value),
    );
    setState(interview);
    setWeeklyFrequency(
      frequencyFromAnswer(
        interview.turns.at(-1)?.stage === "rhythm"
          ? interview.turns.at(-1)?.answer
          : undefined,
        interview.pending?.facts.frequency ?? interview.facts.frequency,
      ),
    );
    // A draft from the old flow could be paused on the now-removed coach
    // validation screen. Let Jev re-check it on the goal screen instead.
    setCandidate(undefined);
    setValidation(undefined);
    setPaywall(value.step === "interview-finish");
    const savedTour = /^coaching-tour-([0-2])$/.exec(value.step);
    setTourStep(savedTour ? Number(savedTour[1]) : null);
    setAwaitingUpgrade(!!value.awaitingUpgrade);
    upgradeIntent.current = !!value.awaitingUpgrade;
    // Old drafts keep their goal, schedule and activity; the coach confirms them in the new interview.
    if ((!value.interview || interview.stage === "goal") && value.goal)
      setAnswer(value.goal);
  }, [saved.data, preview]);
  useEffect(() => {
    if (
      !aiConsent.allowed ||
      !["goal", "baseline", "motivation"].includes(state.stage) ||
      !!candidate ||
      !!validation ||
      paywall ||
      finished
    )
      return;
    const text = answer.trim();
    const requestId = ++guidanceRequest.current;
    if (text.length < 3) {
      setGoalGuidance(initialGoalGuidance(state.stage));
      setGoalGuidanceBusy(false);
      return;
    }
    setGoalGuidanceBusy(true);
    const timer = setTimeout(() => {
      void api
        .post<GoalGuidanceResult>("/follow-through/onboarding/goal-guidance", {
          step: guidanceStep(state.stage),
          answer: text,
          goal: state.facts.goal || undefined,
          activityTitle: state.facts.activityTitle || undefined,
        })
        .then(({ data }) => {
          if (guidanceRequest.current === requestId) setGoalGuidance(guidanceForStage(data, state.stage));
        })
        .catch(() => {
          // Jev is the goal gate now; do not silently treat an unavailable
          // evaluator as approval.
          if (guidanceRequest.current === requestId) {
            setGoalGuidance({
              requirements: initialGoalGuidance(state.stage).requirements.map((item) => ({
                ...item,
                detail: "Couldn’t check this answer. Try again, or skip this optional step.",
              })),
            });
          }
        })
        .finally(() => {
          if (guidanceRequest.current === requestId) setGoalGuidanceBusy(false);
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      if (guidanceRequest.current === requestId) setGoalGuidanceBusy(false);
    };
  }, [
    aiConsent.allowed,
    answer,
    candidate,
    finished,
    paywall,
    state.facts.activityTitle,
    state.facts.goal,
    state.stage,
    validation,
  ]);
  const persist = async (value: OnboardingDraft) => {
    if (!preview) await api.put("/follow-through/onboarding/draft", value);
    setDraft(value);
  };
  async function commitAccepted(
    source: InterviewState,
    baseDraft: OnboardingDraft,
    result: InterviewResult,
    selectedAnswer?: string,
  ): Promise<{ state: InterviewState; draft: OnboardingDraft }> {
    const answered = selectedAnswer === undefined
      ? source
      : recordTurn(source, selectedAnswer, result);
    const next = { ...nextStage(answered, result), pending: undefined };
    const done = source.stage === "review";
    const selectedCoaching = source.stage === "support" && result.facts.wantsCoaching;
    const nextDraft: OnboardingDraft = {
      ...applyFacts(baseDraft, result.facts),
      interview: next,
      answers: answered.turns.map((turn) => ({
        question: turn.question,
        answer: turn.answer,
        use: turn.feedback.slice(0, 400),
      })),
      step: done ? "interview-finish" : selectedCoaching ? "coaching-tour-0" : "interview",
    };
    if (source.stage === "support") {
      nextDraft.coaching = selectedCoaching
        ? { ...initialCoaching(), role: result.facts.coachingRole ?? "consistency" }
        : initialCoaching();
      nextDraft.preferences = {
        ...onboardingPreferences(baseDraft),
        coaching: selectedCoaching,
        weeklyReview: selectedCoaching,
        // Training plans get a "did it happen?" check after each planned session.
        checkIn: selectedCoaching && result.facts.coachingRole === "training",
      };
    }
    await persist(nextDraft);
    setHistory((h) => [...h, ...(selectedAnswer === undefined ? [] : [source]), answered]);
    setState(next);
    setCandidate(undefined);
    setValidation(undefined);
    setValidationReady(false);
    setAnswer("");
    setPaywall(done);
    if (source.stage === "support") setTourStep(selectedCoaching ? 0 : null);
    return { state: next, draft: nextDraft };
  }
  // Everyone sees what the coach does; the paywall is where they choose coaching or free tracking.
  async function chooseCoaching(committed: { state: InterviewState; draft: OnboardingDraft }) {
    const answer = "Yes, coach this plan";
    const result = (
      await api.post<InterviewResult>(
        "/follow-through/onboarding/interview",
        { state: { ...committed.state, pending: undefined }, answer, timezone: committed.draft.timezone },
        { timeout: 90000 },
      )
    ).data;
    // If the coach can't accept it, the coaching question shows as before.
    if (result.accepted) await commitAccepted(committed.state, committed.draft, result, answer);
  }
  const gate = useMutation({
    mutationFn: async (text: string) => {
      Keyboard.dismiss();
      setError(undefined);
      if (state.stage === "goal") {
        const next = acceptGoal(state, text);
        const nextDraft = {
          ...draft,
          goal: text.trim(),
          interview: next,
          step: "interview",
          answers: next.turns.map((turn) => ({
            question: turn.question,
            answer: turn.answer,
            use: turn.feedback.slice(0, 400),
          })),
        };
        await persist(nextDraft);
        setHistory((h) => [...h, state]);
        setState(next);
        setCandidate(undefined);
        setValidation(undefined);
        setValidationReady(false);
        setAnswer("");
        return;
      }
      if (state.stage === "baseline" || state.stage === "motivation") {
        const next = acceptContext(state, text);
        await persist({
          ...draft,
          interview: next,
          step: "interview",
          answers: next.turns.map((turn) => ({
            question: turn.question,
            answer: turn.answer,
            use: turn.feedback.slice(0, 400),
          })),
        });
        setHistory((h) => [...h, state]);
        setState(next);
        setAnswer("");
        return;
      }
      const result = (
        await api.post<InterviewResult>(
          "/follow-through/onboarding/interview",
          {
            state: { ...state, pending: undefined },
            answer: text,
            timezone: draft.timezone,
          },
          { timeout: 90000 },
        )
      ).data;
      if (state.stage === "support" && result.accepted) {
        await commitAccepted(state, draft, result, text);
        return;
      }
      // A clean answer moves straight on; the coach's check only shows when something needs work.
      if (result.accepted && !result.needsImprovement) {
        const committed = await commitAccepted(state, draft, result, text);
        if (state.stage === "rhythm") await chooseCoaching(committed);
        return;
      }
      const next = recordTurn(state, text, result);
      if (result.accepted) next.pending = result;
      await persist({
        ...draft,
        interview: next,
        step: "interview",
        answers: next.turns.map((turn) => ({
          question: turn.question,
          answer: turn.answer,
          use: turn.feedback.slice(0, 400),
        })),
      });
      setHistory((h) => [...h, state]);
      setState(next);
      setCandidate(result.accepted ? result : undefined);
      setValidation(result);
      setValidationReady(false);
      setAnswer("");
    },
  });
  const accept = useMutation({
    mutationFn: async () => {
      if (!candidate?.accepted) return;
      const committed = await commitAccepted(state, draft, candidate);
      if (state.stage === "rhythm") await chooseCoaching(committed);
    },
  });
  async function advanceTour() {
    if (tourStep === null) return;
    const next = tourStep + 1;
    await persist({ ...draft, step: next < 3 ? `coaching-tour-${next}` : "interview" });
    setTourStep(next < 3 ? next : null);
  }
  const complete = useMutation({
    mutationFn: async (coaching: boolean) => {
      if (preview) {
        setFinished(true);
        return;
      }
      if (finishing.current) return;
      finishing.current = true;
      try {
        const preferences: SupportPreferences = draft.preferences || {
          coaching,
          reminder: false,
          reminderMinutes: 30,
          dayReminderTime: "09:00",
          checkIn: false,
          checkInTime: "10:00",
          weeklyReview: false,
          reviewDay: 0,
          reviewTime: "18:00",
        };
        const result = (
          await api.post<{ planId: string }>(
            "/follow-through/onboarding/finish",
            {
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
            },
          )
        ).data;
        await client.invalidateQueries();
        if (mounted.current)
          router.replace(
            `/(tabs)/plans?selectedPlan=${result.planId}` as never,
          );
      } catch (err) {
        finishing.current = false;
        throw err;
      }
    },
  });
  const paid =
    !!user.data?.planType && user.data.planType !== "FREE" && !preview;
  const offer = useQuery({
    queryKey: ["coaching-offer"],
    enabled: paywall && state.facts.wantsCoaching && !paid,
    queryFn: async () =>
      (await api.get<CoachingOffer>("/follow-through/onboarding/offer")).data,
  });
  const plans: CoachingPlan[] =
    offer.data?.plans ?? (offer.data ? [{ ...offer.data, id: "monthly" }] : []);
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? plans[0];
  // The full coaching paywall, while the choice is still open.
  const coachPaywall =
    paywall && state.facts.wantsCoaching && !paid && !awaitingUpgrade && !finished && plans.length > 0;
  // A return from checkout is not payment confirmation. The account entitlement is authoritative.
  const checkUpgrade = useRef(async () => {});
  checkUpgrade.current = async () => {
    if (
      checking ||
      finishing.current ||
      preview ||
      !awaitingUpgrade ||
      checkoutOpen.current
    )
      return;
    setChecking(true);
    try {
      const response = await user.refetch();
      if (response.error) throw response.error;
      if (!mounted.current || !upgradeIntent.current) return;
      if (response.data?.planType && response.data.planType !== "FREE") {
        setAwaitingUpgrade(false);
        complete.mutate(true);
      }
    } catch (err) {
      setError(err);
    } finally {
      if (mounted.current) setChecking(false);
    }
  };
  useEffect(() => {
    if (!awaitingUpgrade || preview || !paywall) return;
    void checkUpgrade.current();
    const started = Date.now();
    const interval = setInterval(() => {
      if (
        Date.now() - started < 120000 &&
        AppState.currentState !== "background"
      )
        void checkUpgrade.current();
    }, 2000);
    const sub = AppState.addEventListener("change", (mode) => {
      if (mode === "active") void checkUpgrade.current();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [awaitingUpgrade, preview, paywall]);
  const checkout = useMutation({
    mutationFn: async () => {
      if (preview) {
        setFinished(true);
        return;
      }
      if (!selectedPlan) return;
      // Recheck before charging so an existing/newly confirmed subscription cannot start twice.
      const account = await user.refetch();
      if (account.error) throw account.error;
      if (account.data?.planType && account.data.planType !== "FREE") {
        complete.mutate(true);
        return;
      }
      await persist({ ...draft, awaitingUpgrade: true });
      upgradeIntent.current = true;
      setAwaitingUpgrade(true);
      checkoutOpen.current = true;
      try {
        await WebBrowser.openBrowserAsync(selectedPlan.url);
      } finally {
        checkoutOpen.current = false;
        void checkUpgrade.current();
      }
    },
  });
  const requestBusy =
    gate.isPending ||
    accept.isPending ||
    complete.isPending ||
    checkout.isPending;
  const busy = requestBusy || dictationBusy;
  const statusError =
    error ||
    gate.error ||
    accept.error ||
    complete.error ||
    checkout.error ||
    (!preview && saved.error) ||
    (paywall && offer.error);
  const askingWeeklyFrequency =
    state.stage === "rhythm" &&
    state.question.title === weeklyFrequencyQuestionTitle;
  const submittedAnswer = () =>
    askingWeeklyFrequency
      ? `${weeklyFrequency} sessions a week`
      : answer.trim() || "I confirm this plan fits my goal and my week.";
  const retryStatus = () => {
    if (error) {
      setError(undefined);
      return;
    }
    if (gate.error) {
      gate.mutate(submittedAnswer());
    } else if (accept.error && candidate?.accepted) {
      accept.mutate();
    } else if (complete.error) {
      complete.mutate(paid && state.facts.wantsCoaching);
    } else if (checkout.error) {
      checkout.mutate();
    } else if (saved.error) {
      void saved.refetch();
    } else if (offer.error) {
      void offer.refetch();
    }
  };
  async function startOver() {
    Keyboard.dismiss();
    gate.reset();
    accept.reset();
    complete.reset();
    checkout.reset();
    setError(undefined);
    const goal = initialGoal?.trim() ?? "";
    const nextDraft = {
      ...newDraft(randomUUID()),
      ...(goal ? { goal } : {}),
    };
    setDraft(nextDraft);
    setState(startInterview(nextDraft));
    setAnswer(goal);
    setWeeklyFrequency(nextDraft.frequency);
    setCandidate(undefined);
    setValidation(undefined);
    setValidationReady(false);
    setGoalGuidance(initialGoalGuidance("goal"));
    setHistory([]);
    setPaywall(false);
    setTourStep(null);
    setFinished(false);
    setAwaitingUpgrade(false);
    upgradeIntent.current = false;
    finishing.current = false;
    try {
      await persist(nextDraft);
    } catch (err) {
      setError(err);
    }
  }
  async function back() {
    if (tourStep !== null) {
      if (tourStep > 0) {
        await persist({ ...draft, step: `coaching-tour-${tourStep - 1}` });
        setTourStep(tourStep - 1);
        return;
      }
      setTourStep(null);
    }
    const validationAnswer = validation
      ? state.turns.at(-1)?.answer
      : undefined;
    setError(undefined);
    setValidation(undefined);
    setValidationReady(false);
    gate.reset();
    accept.reset();
    if (paywall) {
      const reviewStartIndex = history.findLastIndex(
        (entry) => entry.stage === "review" && !entry.turns.some((turn) => turn.stage === "review"),
      );
      const reviewStart = history[reviewStartIndex];
      await persist({
        ...draft,
        interview: reviewStart ?? state,
        step: "interview",
        awaitingUpgrade: false,
      });
      if (reviewStart) {
        setState(reviewStart);
        setHistory((h) => h.slice(0, reviewStartIndex));
      }
      upgradeIntent.current = false;
      setAwaitingUpgrade(false);
      setPaywall(false);
      return;
    }
    if (!validation && tourStep === null && state.stage === "review" && state.facts.wantsCoaching) {
      await persist({ ...draft, step: "coaching-tour-2" });
      setTourStep(2);
      return;
    }
    // A completed question produces both pre-answer and accepted snapshots.
    // Reopen the earliest snapshot for that stage so a correction does not
    // carry the previous answer into the next coach request.
    const previousIndex = validation
      ? history.length - 1
      : history.findLastIndex((entry) => entry.stage !== state.stage && entry.stage !== "support");
    const previous = history[previousIndex];
    if (previous) {
      let stageStartIndex = previousIndex;
      while (
        stageStartIndex > 0 &&
        history[stageStartIndex - 1].stage === previous.stage
      )
        stageStartIndex--;
      const editable = reopenInterviewStage(
        history[stageStartIndex],
        previous.stage,
      );
      const priorAnswer =
        validationAnswer ||
        [...state.turns]
          .reverse()
          .find((turn) => turn.stage === previous.stage)?.answer ||
        [...previous.turns]
          .reverse()
          .find((turn) => turn.stage === previous.stage)?.answer;
      await persist({ ...draft, interview: editable });
      setState(editable);
      setCandidate(undefined);
      if (previous.stage === "rhythm")
        setWeeklyFrequency(
          frequencyFromAnswer(
            priorAnswer,
            previous.pending?.facts.frequency ?? previous.facts.frequency,
          ),
        );
      setAnswer(
        priorAnswer ||
          (previous.stage === "goal" ? draft.goal || previous.facts.goal : ""),
      );
      setHistory((h) => h.slice(0, stageStartIndex));
    } else if (state.stage !== "goal") {
      const stage = stages[Math.max(0, stages.indexOf(state.stage) - 1)];
      const prior = [...state.turns]
        .reverse()
        .find((turn) => turn.stage === stage);
      const question =
        stage === "rhythm" &&
        prior?.question === weeklyFrequencyQuestionTitle
          ? weeklyFrequencyQuestion
          : {
              title: prior?.question || "What would you like to change?",
              purpose:
                "Your later answers will be checked against this change.",
              options: [],
            };
      const next = reopenInterviewStage(state, stage, question);
      await persist({ ...draft, interview: next });
      setState(next);
      setCandidate(undefined);
      setAnswer(prior?.answer || "");
      if (stage === "rhythm")
        setWeeklyFrequency(
          frequencyFromAnswer(prior?.answer, state.facts.frequency),
        );
    }
  }
  const Icon = {
    goal: Goal,
    baseline: Route,
    motivation: Heart,
    rhythm: CalendarDays,
    support: HeartHandshake,
    review: Sparkles,
  }[state.stage];
  const lastTurn = state.turns.at(-1);
  // One bar from the first question to the paywall: 4 questions, 3 coach steps, the plan, the paywall.
  const questions: InterviewStage[] = ["goal", "baseline", "motivation", "rhythm"];
  const journeyProgress = paywall
    ? { current: 9, total: 9, label: state.facts.wantsCoaching && !paid ? "Your trial" : "Ready to start" }
    : tourStep !== null || state.stage === "support"
      ? { current: 5 + (tourStep ?? 0), total: 9, label: "Your coach" }
      : state.stage === "review"
        ? { current: 8, total: 9, label: stageLabels.review }
        : { current: questions.indexOf(state.stage) + 1, total: 9, label: stageLabels[state.stage] };
  const showingValidation =
    (gate.isPending && state.stage !== "goal") || !!validation;
  const stepKey = `${state.stage}-${state.turns.length}-${showingValidation}-${tourStep}-${paywall}-${finished}`;
  const continueValidation = () => {
    if (!validation) return;
    if (validation.accepted) {
      accept.mutate();
      return;
    }
    setValidation(undefined);
    setValidationReady(false);
  };
  const editAnswer = () => {
    setValidation(undefined);
    setValidationReady(false);
    setCandidate(undefined);
    setAnswer(lastTurn?.answer || "");
  };
  const checkingContext = ["goal", "baseline", "motivation"].includes(state.stage);
  const goalGuidanceBlocked = checkingContext &&
    (!goalGuidance.requirements[0]?.passed || goalGuidance.requirements[0]?.key !== guidanceStep(state.stage));
  const action = showingValidation ? (
    gate.isPending || !validation || !validationReady ? (
      <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>
        Checking your answer…
      </Text>
    ) : (
      <>
        {validation.accepted && validation.needsImprovement ? (
          <>
            <EditorButton label="Improve my answer" onPress={editAnswer} />
            <EditorButton
              label="Continue anyway"
              secondary
              disabled={accept.isPending}
              onPress={continueValidation}
            />
          </>
        ) : validation.accepted ? (
          <>
            <EditorButton label="Continue" onPress={continueValidation} />
            <EditorButton
              label="Edit my answer"
              secondary
              disabled={accept.isPending}
              onPress={editAnswer}
            />
          </>
        ) : (
          <EditorButton label="Improve my answer" onPress={editAnswer} />
        )}
      </>
    )
  ) : finished ? (
    <EditorButton label="Back to Settings" onPress={goBack} />
  ) : tourStep !== null ? (
    <EditorButton
      label={tourStep === 2 ? "Review my plan" : "Continue"}
      busy={busy}
      onPress={() => void advanceTour().catch(setError)}
    />
  ) : paywall ? (
    <>
      {state.facts.wantsCoaching &&
        (paid ? (
          <EditorButton
            label="Start with my coach"
            busy={complete.isPending}
            onPress={() => complete.mutate(true)}
          />
        ) : awaitingUpgrade ? (
          <>
            <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>
              Checking your subscription. We’ll open your plan as soon as access
              is confirmed.
            </Text>
            <EditorButton
              label="Check subscription again"
              secondary
              busy={checking || complete.isPending}
              onPress={() => void checkUpgrade.current()}
            />
          </>
        ) : (
          <EditorButton
            label={paywallCta(selectedPlan)}
            busy={checkout.isPending}
            disabled={!selectedPlan}
            onPress={() => checkout.mutate()}
          />
        ))}
      {coachPaywall ? (
        // Free stays available, but quietly: the paywall is about the coach.
        <Pressable
          accessibilityRole="button"
          disabled={complete.isPending || checkout.isPending}
          onPress={() => {
            upgradeIntent.current = false;
            setAwaitingUpgrade(false);
            complete.mutate(false);
          }}
          style={{ alignItems: "center", paddingVertical: 6 }}
        >
          <Text style={{ color: c.muted, fontSize: 14, textDecorationLine: "underline" }}>
            Just track it for free
          </Text>
        </Pressable>
      ) : (
        <EditorButton
          label={
            state.facts.wantsCoaching
              ? "Continue with free tracking"
              : "Create my plan"
          }
          secondary={state.facts.wantsCoaching}
          busy={complete.isPending}
          disabled={checkout.isPending}
          onPress={() => {
            upgradeIntent.current = false;
            setAwaitingUpgrade(false);
            complete.mutate(false);
          }}
        />
      )}
      {coachPaywall && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
          {[
            ["Terms", () => void WebBrowser.openBrowserAsync("https://tracking.so/terms")],
            ["Restore", () => void checkUpgrade.current()],
            ["Privacy", () => void WebBrowser.openBrowserAsync("https://tracking.so/privacy")],
          ].map(([label, onPress]) => (
            <Pressable key={label as string} accessibilityRole="link" onPress={onPress as () => void}>
              <Text style={{ color: c.muted, fontSize: 12 }}>{label as string}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  ) : state.stage === "support" ? (
    <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>
      Choose how you want to use this plan.
    </Text>
  ) : (
    <>
    <EditorButton
      label={
        gate.isPending
          ? "Thinking it through…"
          : state.stage === "review" && !answer.trim()
            ? "This feels right"
            : "Continue"
      }
      busy={gate.isPending}
      disabled={
        busy ||
        goalGuidanceBlocked ||
        goalGuidanceBusy ||
        (state.stage !== "review" &&
          !askingWeeklyFrequency &&
          !answer.trim()) ||
        (!preview && saved.isPending)
      }
      onPress={() => gate.mutate(submittedAnswer())}
    />
    {(state.stage === "baseline" || state.stage === "motivation") && (
      <EditorButton
        label="Skip for now"
        secondary
        disabled={busy}
        onPress={() => gate.mutate("")}
      />
    )}
    </>
  );
  const actionWithStartOver = finished || tourStep !== null || paywall || state.stage !== "goal" ? (
    action
  ) : (
    <>
      {action}
      <EditorButton
        label="Start over"
        secondary
        disabled={busy}
        onPress={() => void startOver()}
      />
    </>
  );
  // Without AI consent: explain (under the consent sheet), and offer the manual plan editor.
  if (user.data && !aiConsent.allowed)
    return (
      <InterviewFrame
        stage="goal"
        progress={{ current: 1, total: 1, label: "Before we start" }}
        preview={preview}
        busy={false}
        backDisabled
        onBack={() => {}}
        onClose={goBack}
        actions={
          <>
            <EditorButton
              label="Allow AI features"
              onPress={() => void aiConsent.ask()}
            />
            <EditorButton
              label="Create a plan by hand"
              secondary
              onPress={() => router.replace("/create-plan-advanced" as never)}
            />
          </>
        }
      >
        <View style={{ alignItems: "center", gap: 24 }}>
          <View style={{ height: 100, justifyContent: "center" }}>
            <Sparkles size={80} strokeWidth={1.4} color={c.accent} />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 28,
              lineHeight: 35,
              fontWeight: "700",
              textAlign: "center",
              letterSpacing: -0.5,
            }}
          >
            This setup uses AI
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
            }}
          >
            Your coach asks a few questions and drafts your plan with AI. Allow
            AI features to continue, or create a plan yourself and track it by
            hand.
          </Text>
        </View>
        {aiConsent.sheet}
      </InterviewFrame>
    );
  return (
    <InterviewFrame
      stage={state.stage}
      progress={journeyProgress}
      preview={preview}
      busy={busy}
      backDisabled={!paywall && !history.length && state.stage === "goal"}
      onBack={() => void back().catch(setError)}
      onClose={goBack}
      actions={actionWithStartOver}
    >
      {showingValidation ? (
        <CoachValidation
          loading={gate.isPending}
          result={validation}
          stage={state.stage}
          strategist={user.data?.coachPersonality === "STRATEGIST"}
          onMessageRendered={() => setValidationReady(true)}
        />
      ) : tourStep !== null ? (
        <CoachingTour
          step={tourStep}
          facts={state.facts}
          coaching={draft.coaching ?? { ...initialCoaching(), role: state.facts.coachingRole ?? "consistency" }}
          preferences={onboardingPreferences(draft)}
          onCoaching={(coaching) => setDraft((current) => ({ ...current, coaching }))}
          onPreferences={(preferences) => setDraft((current) => ({ ...current, preferences }))}
        />
      ) : (
        <>
          {!coachPaywall && <Reveal key={`heading-${stepKey}`}>
            <View style={{ alignItems: "center", gap: paywall ? 14 : 24 }}>
              {!paywall && <View style={{ height: 100, justifyContent: "center" }}>
                <Icon size={80} strokeWidth={1.4} color={c.accent} />
              </View>}
              <Text
                accessibilityRole="header"
                style={{
                  color: c.text,
                  fontSize: paywall ? 26 : 28,
                  lineHeight: paywall ? 32 : 35,
                  fontWeight: "700",
                  textAlign: "center",
                  letterSpacing: -0.5,
                }}
              >
                {finished
                  ? "Your preview is complete"
                  : paywall
                    ? state.facts.wantsCoaching
                      ? paid ? "Your plan is ready." : "Your plan is ready. Your coach is next."
                      : "Your plan is ready."
                    : state.question.title}
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontSize: paywall ? 15 : 16,
                  lineHeight: paywall ? 22 : 24,
                  textAlign: "center",
                }}
              >
                {finished
                  ? "You used the same interview and AI checks as a new member. This preview hasn’t created a plan or started a subscription."
                  : paywall
                    ? state.facts.wantsCoaching
                      ? paid
                        ? "Set up the first week with your coach, or keep this plan as free tracking."
                        : "Start your trial to set up the first week with your coach. Or keep this plan and track it for free."
                      : "Start tracking your sessions for free. You can add coaching later."
                    : state.question.purpose}
              </Text>
            </View>
          </Reveal>}
          {!finished && (
            <Reveal key={`content-${stepKey}`} delay={100}>
              <View style={{ gap: 16 }}>
                {coachPaywall ? (
                  <Paywall facts={state.facts} plans={plans} selected={selectedPlan!.id} onSelect={setPlanId} />
                ) : (
                  paywall && <PlanConclusion facts={state.facts} coaching={draft.coaching} preferences={draft.preferences} />
                )}
                {state.stage === "review" && !paywall && <PlanSummary facts={state.facts} />}
                {!candidate && !paywall && (
                  <>
                    {lastTurn && !lastTurn.accepted && (
                      <CoachSuggestion message={lastTurn.feedback} />
                    )}
                    {askingWeeklyFrequency ? (
                      <WeeklyFrequencyPicker
                        value={weeklyFrequency}
                        onChange={setWeeklyFrequency}
                        disabled={busy}
                      />
                    ) : state.stage === "support" ? (
                      <View style={{ gap: 14 }}>
                        {state.question.options.map((option) => (
                          <Pressable
                            key={option}
                            accessibilityRole="button"
                            accessibilityLabel={option}
                            disabled={busy}
                            onPress={() => gate.mutate(option)}
                            style={({ pressed }) => ({
                              minHeight: 72,
                              padding: 18,
                              borderRadius: 16,
                              backgroundColor: c.card,
                              opacity: pressed || busy ? 0.6 : 1,
                              gap: 5,
                            })}
                          >
                            <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>{option}</Text>
                            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
                              {option.toLowerCase().includes("coach")
                                ? "Get guidance, check-ins and changes to review. Try it free before deciding."
                                : "Keep your plan and progress, without a subscription."}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <>
                        {state.question.options.map((option) => (
                          <Pressable
                            key={option}
                            accessibilityRole="button"
                            accessibilityLabel={option}
                            disabled={busy}
                            onPress={() => {
                              setAnswer(option);
                              gate.mutate(option);
                            }}
                            style={({ pressed }) => ({
                              minHeight: 54,
                              padding: 16,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: c.inputBorder,
                              backgroundColor: c.card,
                              opacity: pressed || busy ? 0.6 : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: c.text,
                                fontSize: 15,
                                lineHeight: 21,
                              }}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        ))}
                        <View style={{ position: "relative" }}>
                          <TextInput
                            accessibilityLabel="Your answer"
                            testID="onboarding-answer"
                            value={answer}
                            onChangeText={setAnswer}
                            editable={!busy}
                            multiline
                            placeholder={
                              state.stage === "goal"
                                ? "I’d love to…"
                                : state.stage === "review"
                                  ? "Anything you’d like to change?"
                                  : "In your own words…"
                            }
                            placeholderTextColor={c.muted}
                            style={{
                              minHeight: state.stage === "review" ? 90 : 132,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: c.inputBorder,
                              backgroundColor: c.card,
                              padding: 18,
                              paddingRight: 68,
                              paddingBottom: 58,
                              fontSize: 17,
                              lineHeight: 25,
                              color: c.text,
                              textAlignVertical: "top",
                            }}
                          />
                          <View
                            style={{ position: "absolute", right: 12, bottom: 12 }}
                          >
                            <DictationButton
                              disabled={requestBusy}
                              onBusyChange={setDictationBusy}
                              onError={setError}
                              onTranscript={(transcript) =>
                                setAnswer(
                                  (current) =>
                                    `${current.trimEnd()}${current.trim() ? " " : ""}${transcript}`,
                                )
                              }
                            />
                          </View>
                        </View>
                        {checkingContext && answer.trim().length >= 3 && (
                          <GoalGuidance result={goalGuidance} loading={goalGuidanceBusy} />
                        )}
                      </>
                    )}
                  </>
                )}
                {paywall &&
                  state.facts.wantsCoaching &&
                  !paid &&
                  !coachPaywall &&
                  offer.data && (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: c.card,
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: c.text,
                          fontWeight: "600",
                          fontSize: 18,
                        }}
                      >
                        {offer.data.trialDays
                          ? `${offer.data.trialDays} days to try coaching`
                          : "Coaching"}
                      </Text>
                      <Text
                        style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}
                      >
                        {offer.data.trialDays ? "Then " : ""}
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: offer.data.currency,
                        }).format(offer.data.amount / 100)}{" "}
                        /{" "}
                        {offer.data.intervalCount > 1
                          ? `${offer.data.intervalCount} `
                          : ""}
                        {offer.data.interval}. Cancel through billing before
                        renewal.
                      </Text>
                    </View>
                  )}
                {preview && paywall && (
                  <Text
                    style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                  >
                    {state.facts.wantsCoaching
                      ? "Preview only. No plan or subscription starts here."
                      : "Preview only. No plan is created here."}
                  </Text>
                )}
              </View>
            </Reveal>
          )}
        </>
      )}
      <Status
        loading={!preview && saved.isPending}
        error={statusError}
        retry={retryStatus}
      />
    </InterviewFrame>
  );
}
