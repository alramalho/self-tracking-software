import { useEffect, useRef, useState } from "react";
import { AppState, Keyboard, Pressable, TextInput, View } from "react-native";
import {
  CalendarDays,
  Goal,
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
  InterviewState,
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
import { newDraft } from "./model";
import { InterviewFrame } from "./interview/Frame";
import { PlanSummary } from "./interview/PlanSummary";
import { AutoContinueAction } from "./interview/AutoContinueAction";
import { CoachSuggestion } from "./interview/CoachSuggestion";
import { CoachValidation } from "./interview/CoachValidation";
import {
  applyFacts,
  nextStage,
  recordTurn,
  startInterview,
  stages,
} from "./interview/model";
import type { CoachingOffer, OnboardingProps } from "./types";

export default function Onboarding({
  preview = false,
  initialGoal,
}: OnboardingProps) {
  const c = useColors(),
    client = useQueryClient(),
    user = useCurrentUser(),
    saved = useFollowThrough(!preview);
  const [draft, setDraft] = useState(() => ({
    ...newDraft(randomUUID()),
    ...(initialGoal?.trim() ? { goal: initialGoal.trim() } : {}),
  }));
  const [state, setState] = useState<InterviewState>(() =>
    startInterview(draft),
  );
  const [answer, setAnswer] = useState(initialGoal?.trim() ?? "");
  const [candidate, setCandidate] = useState<InterviewResult>();
  const [validation, setValidation] = useState<InterviewResult>();
  const [validationReady, setValidationReady] = useState(false);
  const [history, setHistory] = useState<InterviewState[]>([]);
  const [paywall, setPaywall] = useState(false),
    [finished, setFinished] = useState(false);
  const [awaitingUpgrade, setAwaitingUpgrade] = useState(false),
    [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>();
  const [dictationBusy, setDictationBusy] = useState(false);
  const upgradeIntent = useRef(false);
  const loaded = useRef(false),
    finishing = useRef(false),
    mounted = useRef(true),
    checkoutOpen = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (preview || loaded.current || !saved.data) return;
    loaded.current = true;
    const value = saved.data.state.draft;
    if (!value || value.createdPlanId) return;
    setDraft(value);
    const interview = value.interview || startInterview(value);
    setState(interview);
    setCandidate(interview.pending);
    setValidation(interview.pending);
    setPaywall(value.step === "interview-finish");
    setAwaitingUpgrade(!!value.awaitingUpgrade);
    upgradeIntent.current = !!value.awaitingUpgrade;
    // Old drafts keep their goal, schedule and activity; the coach confirms them in the new interview.
    if (!value.interview && value.goal) setAnswer(value.goal);
  }, [saved.data, preview]);
  const persist = async (value: OnboardingDraft) => {
    if (!preview) await api.put("/follow-through/onboarding/draft", value);
    setDraft(value);
  };
  const gate = useMutation({
    mutationFn: async (text: string) => {
      Keyboard.dismiss();
      setError(undefined);
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
      const next = { ...nextStage(state, candidate), pending: undefined };
      const done = state.stage === "review";
      await persist({
        ...applyFacts(draft, candidate.facts),
        interview: next,
        step: done ? "interview-finish" : "interview",
      });
      setHistory((h) => [...h, state]);
      setState(next);
      setCandidate(undefined);
      setValidation(undefined);
      setValidationReady(false);
      setAnswer("");
      setPaywall(done);
    },
  });
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
              draft: { ...draft, awaitingUpgrade: false },
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
      if (!offer.data) return;
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
        await WebBrowser.openBrowserAsync(offer.data.url);
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
  async function back() {
    const validationAnswer = validation
      ? state.turns.at(-1)?.answer
      : undefined;
    setError(undefined);
    setValidation(undefined);
    setValidationReady(false);
    gate.reset();
    accept.reset();
    if (paywall) {
      await persist({ ...draft, step: "interview", awaitingUpgrade: false });
      upgradeIntent.current = false;
      setAwaitingUpgrade(false);
      setPaywall(false);
      return;
    }
    const previous = history.at(-1);
    if (previous) {
      await persist({ ...draft, interview: previous });
      setState(previous);
      setCandidate(previous.pending);
      setAnswer(validationAnswer || "");
      setHistory((h) => h.slice(0, -1));
    } else if (state.stage !== "goal") {
      const stage = stages[Math.max(0, stages.indexOf(state.stage) - 1)];
      const prior = [...state.turns]
        .reverse()
        .find((turn) => turn.stage === stage);
      const next = {
        ...state,
        stage,
        pending: undefined,
        question: {
          title: prior?.question || "What would you like to change?",
          purpose: "Your later answers will be checked against this change.",
          options: [],
        },
        confirmed: state.confirmed.filter(
          (value) => stages.indexOf(value) < stages.indexOf(stage),
        ),
      };
      await persist({ ...draft, interview: next });
      setState(next);
      setCandidate(undefined);
      setAnswer(prior?.answer || "");
    }
  }
  const Icon = {
    goal: Goal,
    baseline: Route,
    rhythm: CalendarDays,
    support: HeartHandshake,
    review: Sparkles,
  }[state.stage];
  const lastTurn = state.turns.at(-1);
  const showingValidation = gate.isPending || !!validation;
  const stepKey = `${state.stage}-${state.turns.length}-${showingValidation}-${paywall}-${finished}`;
  const continueValidation = () => {
    if (!validation) return;
    if (validation.accepted) {
      accept.mutate();
      return;
    }
    setValidation(undefined);
    setValidationReady(false);
  };
  const action = showingValidation ? (
    gate.isPending || !validation || !validationReady ? (
      <Text style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>
        Checking your answer…
      </Text>
    ) : (
      <>
        <AutoContinueAction
          key={`${state.stage}-${state.turns.length}`}
          label={validation.accepted ? "Continue" : "Improve my answer"}
          onContinue={continueValidation}
        />
        {validation.accepted && (
          <EditorButton
            label="Edit my answer"
            secondary
            disabled={accept.isPending}
            onPress={() => {
              setValidation(undefined);
              setValidationReady(false);
              setCandidate(undefined);
              setAnswer(lastTurn?.answer || "");
            }}
          />
        )}
      </>
    )
  ) : finished ? (
    <EditorButton label="Back to Settings" onPress={goBack} />
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
            label={
              preview
                ? "Preview coaching unlock"
                : offer.data?.trialDays
                  ? "Start coaching trial"
                  : "Choose coaching"
            }
            busy={checkout.isPending}
            disabled={!offer.data}
            onPress={() => checkout.mutate()}
          />
        ))}
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
    </>
  ) : (
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
        (state.stage !== "review" && !answer.trim()) ||
        (!preview && saved.isPending)
      }
      onPress={() =>
        gate.mutate(
          answer.trim() || "I confirm this plan fits my goal and my week.",
        )
      }
    />
  );
  return (
    <InterviewFrame
      stage={state.stage}
      preview={preview}
      busy={busy}
      backDisabled={!paywall && !history.length && state.stage === "goal"}
      onBack={() => void back().catch(setError)}
      onClose={goBack}
      actions={action}
    >
      {showingValidation ? (
        <CoachValidation
          loading={gate.isPending}
          result={validation}
          stage={state.stage}
          strategist={user.data?.coachPersonality === "STRATEGIST"}
          onMessageRendered={() => setValidationReady(true)}
        />
      ) : (
        <>
          <Reveal key={`heading-${stepKey}`}>
            <View style={{ alignItems: "center", gap: 24 }}>
              <View style={{ height: 100, justifyContent: "center" }}>
                <Icon size={80} strokeWidth={1.4} color={c.accent} />
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
                {finished
                  ? "Your preview is complete"
                  : paywall
                    ? state.facts.wantsCoaching
                      ? "A plan. And support to follow through."
                      : "Your plan, your pace."
                    : state.question.title}
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 16,
                  lineHeight: 24,
                  textAlign: "center",
                }}
              >
                {finished
                  ? "You used the same interview and AI checks as a new member. This preview hasn’t created a plan or started a subscription."
                  : paywall
                    ? state.facts.wantsCoaching
                      ? "Keep the plan we built together. Choose coaching for guidance, or begin with free tracking."
                      : "Track your sessions and see your progress. You can add coaching later."
                    : state.question.purpose}
              </Text>
            </View>
          </Reveal>
          {!finished && (
            <Reveal key={`content-${stepKey}`} delay={100}>
              <View style={{ gap: 16 }}>
                {state.stage === "review" && (
                  <PlanSummary facts={state.facts} />
                )}
                {!candidate && !paywall && (
                  <>
                    {lastTurn && !lastTurn.accepted && (
                      <CoachSuggestion message={lastTurn.feedback} />
                    )}
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
                  </>
                )}
                {paywall &&
                  state.facts.wantsCoaching &&
                  !paid &&
                  offer.data && (
                    <View
                      style={{
                        padding: 20,
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
                    Preview only. Neither choice charges you or creates a plan.
                    A real member continues into their plan after access is
                    confirmed.
                  </Text>
                )}
              </View>
            </Reveal>
          )}
        </>
      )}
      <Status
        loading={!preview && saved.isPending}
        error={
          error ||
          gate.error ||
          accept.error ||
          complete.error ||
          checkout.error ||
          (!preview && saved.error) ||
          (paywall && offer.error)
        }
        retry={() => {
          if (complete.error)
            complete.mutate(paid && state.facts.wantsCoaching);
          else if (saved.error) void saved.refetch();
          else if (offer.error) void offer.refetch();
        }}
      />
    </InterviewFrame>
  );
}
