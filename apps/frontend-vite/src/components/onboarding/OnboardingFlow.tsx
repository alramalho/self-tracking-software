import type { DesignBaseline, GoalGuidanceResult, OnboardingCircleChoice, OnboardingDraft, PlanDesign } from "@tsw/prisma/follow-through";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { approximateLocation } from "@/components/circles/location";
import { setPendingMatch } from "@/components/circles/pendingMatch";
import type { ApproxLocation, MatchPreferences } from "@/components/circles/types";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import {
  checkAnswer,
  classifyGoal,
  coachingPlans,
  currentPlanType,
  errorMessage,
  finishOnboarding,
  loadDraft,
  reportProgress,
  saveAiConsent,
  saveDraft,
  suggestBaseline,
} from "./api";
import { CircleStep } from "./circle/CircleStep";
import { CoachStep } from "./coach/CoachSteps";
import { ConfidenceSection } from "./confidence/ConfidenceSection";
import { DesignSection } from "./design/DesignSection";
import { OnboardingButton, QuietButton, ScreenHeading } from "./frame/controls";
import { OnboardingFrame } from "./frame/OnboardingFrame";
import {
  acceptContext,
  acceptGoal,
  answersOf,
  applyFacts,
  baselineFrom,
  closeTarget,
  canSkipQuestion,
  coachOf,
  designedFacts,
  finishRequest,
  guidanceFor,
  guidancePassed,
  initialCoaching,
  initialDesign,
  initialGuidance,
  isResumable,
  newDraft,
  onboardingPreferences,
  previousAnswer,
  progressFor,
  reopenStage,
  screenFor,
  showsWelcome,
  startInterview,
  wantsCircle,
} from "./model";
import { Paywall } from "./paywall/Paywall";
import { paywallCta } from "./paywall/plans";
import { QuestionStep } from "./questions/QuestionStep";
import type { AiConsentFields, CoachingPlan, OnboardingFlowProps, QuestionStage } from "./types";
import { AiConsentStep } from "./welcome/AiConsentStep";
import { Welcome } from "./welcome/Welcome";

const aiAllowed = (user?: AiConsentFields) => {
  const granted = user?.aiConsentGrantedAt;
  const declined = user?.aiConsentDeclinedAt;
  return !!granted && (!declined || new Date(granted) > new Date(declined));
};

const screenLabels = {
  question: "Your goal",
  design: "Your week",
  coach: "Your coach",
  circle: "Your circle",
  confidence: "Your plan",
  paywall: "Your trial",
};

// The native app's onboarding on the web: welcome, three questions, the coach's design,
// the coach, a circle, how sure you are, and the paywall. Each answer is saved as a
// server draft, so closing the tab (or switching to the app) resumes the same screen.
export function OnboardingFlow({ initialGoal, flow = "onboarding" }: OnboardingFlowProps) {
  const creating = flow === "create";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const posthog = usePostHog();
  const { currentUser, updateUser, refetchCurrentUser } = useCurrentUser();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [answer, setAnswer] = useState("");
  const [guidance, setGuidance] = useState<GoalGuidanceResult>(() => initialGuidance("goal"));
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [circlePrefs, setCirclePrefs] = useState<MatchPreferences | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const location = useRef<ApproxLocation | null>(null);
  const pendingAge = useRef<number | null>(null);
  const [planId, setPlanId] = useState<CoachingPlan["id"]>("quarterly");
  const [awaitingUpgrade, setAwaitingUpgrade] = useState(false);
  const finishing = useRef(false);
  // A starting point measured from their logs (creating a plan in the app only).
  const loggedBaseline = useRef<DesignBaseline | null>(null);

  const fail = (e: unknown) => setError(errorMessage(e));
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const save = async (next: OnboardingDraft) => {
    setDraft(next);
    await saveDraft(next);
  };

  // Resume a saved draft, or start fresh (a goal passed in skips the welcome).
  useEffect(() => {
    let cancelled = false;
    const fresh = (goal = "") => {
      const start = newDraft(uuidv4(), goal);
      return { ...start, interview: startInterview(start) };
    };
    (initialGoal ? Promise.resolve(null) : loadDraft().catch(() => null)).then((saved) => {
      if (cancelled) return;
      if (saved && isResumable(saved)) {
        const interview = saved.interview ?? startInterview(saved);
        setDraft({ ...saved, interview });
        setAnswer(interview.stage === "goal" ? saved.goal : "");
        setAwaitingUpgrade(!!saved.awaitingUpgrade);
        return;
      }
      // A draft from the old interview keeps its goal; a finished one starts empty.
      const goal = initialGoal?.trim() || (saved && !saved.createdPlanId ? saved.goal : "");
      setDraft(fresh(goal));
      setAnswer(goal);
      setWelcome(showsWelcome(goal, flow));
    });
    return () => {
      cancelled = true;
    };
  }, [initialGoal, flow]);

  const screen = draft ? screenFor(draft) : null;
  const interview = draft?.interview;
  const stage: QuestionStage | null = screen?.name === "question" ? screen.stage : null;

  // Funnel: which screen people reach (PostHog), and where they stopped (for the drop alert).
  const screenId = screen ? (screen.name === "question" ? screen.stage : screen.name === "coach" ? `coach-${screen.step}` : screen.name) : null;
  useEffect(() => {
    if (!draft || !screen || !screenId || welcome) return;
    const progress = progressFor(screen);
    posthog?.capture(creating ? "create-plan-step-viewed" : "onboarding-step-viewed", { step: screenId, platform: "web" });
    if (!creating) void reportProgress(draft, screenId, screenLabels[screen.name], progress.current, progress.total);
    // Only when the screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, welcome]);

  // The coach checks each answer as it's typed: a clear goal is required, the rest is optional.
  useEffect(() => {
    if (!stage) return;
    const text = answer.trim();
    if (text.length < 3) {
      setGuidance(initialGuidance(stage));
      setChecking(false);
      return;
    }
    let current = true;
    setChecking(true);
    const timer = setTimeout(() => {
      checkAnswer(stage, text, interview?.facts.goal)
        .then((result) => current && setGuidance(guidanceFor(result, stage)))
        .catch(() => {
          // An unavailable check is never treated as a pass.
          if (current)
            setGuidance({
              requirements: initialGuidance(stage).requirements.map((item) => ({
                ...item,
                detail: "Couldn’t check this answer. Try again, or skip this optional step.",
              })),
            });
        })
        .finally(() => current && setChecking(false));
    }, 700);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [answer, stage, interview?.facts.goal]);

  const paid = !!currentUser?.planType && currentUser.planType !== "FREE";
  const offer = useQuery({
    queryKey: ["coaching-offer"],
    enabled: screen?.name === "paywall" && !paid,
    queryFn: coachingPlans,
    retry: 1,
  });
  const plans = offer.data ?? [];
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? plans[0];
  useEffectOnce(
    () => posthog?.capture("coach-paywall-viewed", { placement: "onboarding", platform: "web" }),
    screen?.name === "paywall" && !paid && !awaitingUpgrade && plans.length > 0,
  );

  async function complete(coaching: boolean) {
    if (!draft || finishing.current) return;
    finishing.current = true;
    try {
      const { planId: createdPlanId } = await finishOnboarding(finishRequest(draft, coaching));
      posthog?.capture(creating ? "plan-created" : "onboarding-completed", { coaching, platform: "web", flow });
      await refetchCurrentUser(false);
      await queryClient.invalidateQueries();
      const circle = draft.circle;
      if (circle && wantsCircle(circle)) {
        setPendingMatch({
          planId: createdPlanId,
          mode: circle.choice === "invite" ? "invite" : "find",
          wantsPace: circle.wantsPace,
          wantsNearby: circle.wantsNearby,
          wantsAge: circle.wantsAge,
          location: location.current ?? undefined,
        });
        navigate({ to: "/circle-match", search: { planId: createdPlanId }, replace: true });
      } else navigate({ to: "/plans", search: { selectedPlan: createdPlanId }, replace: true });
    } catch (e) {
      finishing.current = false;
      throw e;
    }
  }

  // After checkout, the account's subscription is what counts. Check now, every 2s for 2 minutes, and on return.
  const checkUpgrade = useRef(async () => {});
  checkUpgrade.current = async () => {
    if (!awaitingUpgrade || finishing.current) return;
    if ((await currentPlanType()) !== "FREE") {
      setAwaitingUpgrade(false);
      posthog?.capture("purchase-completed", { placement: "onboarding", store: "stripe" });
      await complete(true);
    }
  };
  useEffect(() => {
    if (!awaitingUpgrade || screen?.name !== "paywall") return;
    const check = () => void checkUpgrade.current().catch(fail);
    check();
    const started = Date.now();
    const timer = setInterval(() => Date.now() - started < 120000 && !document.hidden && check(), 2000);
    const visible = () => !document.hidden && check();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [awaitingUpgrade, screen?.name]);

  // ── Before the questions ──────────────────────────────────────────────────

  if (!draft || !interview || !screen || !currentUser)
    return (
      <OnboardingFrame screenKey="loading" bare>
        <div className="h-24" aria-busy="true" />
      </OnboardingFrame>
    );

  const onboarded = !!currentUser.onboardingCompletedAt;
  const closeTo = closeTarget(flow, onboarded);
  const close = closeTo ? () => navigate({ to: closeTo }) : undefined;

  if (welcome)
    return (
      <Welcome
        savedAge={currentUser.age}
        needsUsername={!!currentUser.username?.startsWith("__pending__")}
        busy={busy}
        onContinue={(age) =>
          void run(async () => {
            pendingAge.current = age;
            if (age !== currentUser.age) await updateUser({ updates: { age }, muteNotifications: true });
            setWelcome(false);
          })
        }
      />
    );

  // The questions and the plan design run on AI, so ask before anything is sent.
  if (!aiAllowed(currentUser))
    return (
      <AiConsentStep
        busy={busy}
        onAllow={() =>
          void run(async () => {
            await saveAiConsent(true);
            await refetchCurrentUser(false);
          })
        }
        onDecline={() =>
          void run(async () => {
            await saveAiConsent(false);
            if (!onboarded) await updateUser({ updates: { onboardingCompletedAt: new Date() }, muteNotifications: true });
            navigate({ to: "/create-plan-advanced" });
          })
        }
      />
    );

  const errorLine = error && (
    <p role="alert" className="text-center text-sm text-destructive">
      {error}
    </p>
  );

  // ── The three questions ───────────────────────────────────────────────────

  if (screen.name === "question") {
    const current = screen.stage;
    const submit = (text: string) =>
      void run(async () => {
        if (current === "goal") {
          // The coach reads the goal first: outcome or habit, the activity, and the right next question.
          const classified = await classifyGoal(text.trim());
          loggedBaseline.current = creating ? await suggestBaseline(classified.activity).catch(() => null) : null;
          const next = acceptGoal(interview, text, classified.baselineQuestion);
          // The answer box changes with the screen, in the same render.
          setAnswer(previousAnswer(next, "baseline") || loggedBaseline.current?.text || "");
          await save({
            ...draft,
            goal: text.trim(),
            emoji: classified.activity.emoji,
            activityTitle: classified.activity.title,
            measure: classified.activity.measure,
            design: initialDesign(classified, "", draft.frequency),
            interview: next,
            step: "interview",
            answers: answersOf(next),
          });
          return;
        }
        const next = acceptContext(interview, text);
        setAnswer(current === "baseline" ? previousAnswer(next, "motivation") : "");
        await save({
          ...draft,
          ...(current === "baseline" && draft.design ? { design: { ...draft.design, baseline: baselineFrom(text, loggedBaseline.current) } } : {}),
          interview: next,
          step: "interview",
          answers: answersOf(next),
        });
      });
    const back = () =>
      void run(async () => {
        const previous = current === "motivation" ? "baseline" : "goal";
        const reopened = reopenStage(interview, previous);
        setAnswer(previousAnswer(interview, previous) || (previous === "goal" ? draft.goal : ""));
        await save({ ...draft, interview: reopened });
      });
    const blocked = !guidancePassed(guidance, current) || checking;
    return (
      <OnboardingFrame
        screenKey={`question-${current}`}
        progress={progressFor(screen)}
        busy={busy}
        onBack={current === "goal" ? undefined : back}
        onSkip={canSkipQuestion(current, draft.design) ? () => submit("") : undefined}
        onClose={close}
        actions={
          <>
            <OnboardingButton label={busy ? "Thinking it through…" : "Continue"} busy={busy} disabled={!answer.trim() || blocked} onClick={() => submit(answer)} />
            {current === "goal" && !!draft.goal && (
              <QuietButton
                label="Start over"
                variant="link"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const start = newDraft(uuidv4());
                    await save({ ...start, interview: startInterview(start) });
                    setAnswer("");
                  })
                }
              />
            )}
          </>
        }
      >
        <QuestionStep
          stage={current}
          title={interview.question.title}
          answer={answer}
          onAnswer={setAnswer}
          guidance={guidance}
          checking={checking}
        />
        {errorLine}
      </OnboardingFrame>
    );
  }

  // ── The coach's design ────────────────────────────────────────────────────

  if (screen.name === "design" && draft.design)
    return (
      <DesignSection
        design={draft.design}
        goal={interview.facts.goal}
        goalReason={interview.facts.goalReason}
        timezone={draft.timezone}
        busy={busy}
        onChange={(design) => save({ ...draft, design })}
        onBack={() =>
          void run(async () => {
            setAnswer(previousAnswer(interview, "motivation"));
            await save({ ...draft, interview: reopenStage(interview, "motivation") });
          })
        }
        onClose={close}
        onDone={(design: PlanDesign) =>
          void run(async () => {
            // The route (or weekly target) is chosen: the coach is part of the plan, so meet it next.
            const facts = designedFacts(design);
            const role = facts.coachingRole;
            await save({
              ...applyFacts(draft, facts),
              design,
              interview: {
                ...interview,
                stage: "review",
                question: { title: "Your plan", purpose: "", options: [] },
                facts: { ...interview.facts, ...facts, baseline: design.baseline.text },
                confirmed: [...new Set([...interview.confirmed, "rhythm" as const])],
                pending: undefined,
              },
              coaching: { ...initialCoaching(), role },
              preferences: { ...onboardingPreferences(draft), coaching: true, weeklyReview: true, checkIn: role === "training" },
              step: "coaching-tour-0",
            });
          })
        }
      />
    );

  const accountCoach = getCoachPersonalityConfig(currentUser.coachPersonality).id === "STRATEGIST" ? "Oli" : "Helly";
  const coach = coachOf(draft.design, accountCoach);

  // ── Meet the coach ────────────────────────────────────────────────────────

  if (screen.name === "coach") {
    const step = screen.step;
    return (
      <OnboardingFrame
        screenKey={`coach-${step}`}
        progress={progressFor(screen)}
        busy={busy}
        onBack={() =>
          void run(async () => {
            if (step > 0) await save({ ...draft, step: `coaching-tour-${step - 1}` });
            // Back from the first coach screen reopens the chosen plan.
            else await save({ ...draft, step: "interview", interview: { ...interview, stage: "rhythm" } });
          })
        }
        onClose={close}
        actions={
          <OnboardingButton
            label="Continue"
            busy={busy}
            onClick={() => void run(() => save({ ...draft, step: step < 2 ? `coaching-tour-${step + 1}` : "interview" }))}
          />
        }
      >
        <CoachStep
          step={step}
          coach={coach}
          facts={interview.facts}
          coaching={draft.coaching ?? { ...initialCoaching(), role: interview.facts.coachingRole ?? "consistency" }}
          preferences={onboardingPreferences(draft)}
          onCoaching={(coaching) => setDraft({ ...draft, coaching })}
          onPreferences={(preferences) => setDraft({ ...draft, preferences })}
        />
        {errorLine}
      </OnboardingFrame>
    );
  }

  // ── A circle ──────────────────────────────────────────────────────────────

  if (screen.name === "circle") {
    const choose = (circle: OnboardingCircleChoice) =>
      void run(async () => {
        const age = pendingAge.current;
        if (circle.choice === "find" && circle.wantsAge && age && age !== currentUser.age)
          await updateUser({ updates: { age }, muteNotifications: true });
        await save({ ...draft, circle, step: "confidence" });
        setCirclePrefs(null);
      });
    // Nearby needs a rough location; without it, matching falls back to time zones.
    const changePrefs = async (next: MatchPreferences | null) => {
      setCirclePrefs(next);
      if (!next?.wantsNearby || circlePrefs?.wantsNearby || location.current) return;
      setLocating(true);
      try {
        location.current = await approximateLocation();
        setLocationDenied(!location.current);
        if (!location.current) setCirclePrefs({ ...next, wantsNearby: false });
      } catch {
        setLocationDenied(true);
        setCirclePrefs({ ...next, wantsNearby: false });
      } finally {
        setLocating(false);
      }
    };
    const solo = { wantsPace: true, wantsNearby: false, wantsAge: false };
    return (
      <OnboardingFrame
        screenKey={circlePrefs ? "circle-match" : "circle"}
        progress={progressFor(screen, !!circlePrefs)}
        busy={busy}
        onBack={() => (circlePrefs ? setCirclePrefs(null) : void run(() => save({ ...draft, step: "coaching-tour-2" })))}
        onClose={close}
        actions={
          circlePrefs ? (
            <OnboardingButton label="Continue" busy={busy} disabled={locating} onClick={() => choose({ choice: "find", ...circlePrefs })} />
          ) : undefined
        }
      >
        <CircleStep
          prefs={circlePrefs}
          age={pendingAge.current ?? currentUser.age}
          weeklyTarget={interview.facts.frequency}
          busy={busy}
          locating={locating}
          locationDenied={locationDenied}
          place={location.current?.place ?? null}
          onPrefs={(next) => void changePrefs(next)}
          onAge={(age) => (pendingAge.current = age)}
          onInvite={() => choose({ choice: "invite", ...solo })}
          onSolo={() => choose({ choice: "solo", ...solo })}
        />
        {errorLine}
      </OnboardingFrame>
    );
  }

  // ── How sure are you ──────────────────────────────────────────────────────

  if (screen.name === "confidence" && draft.design)
    return (
      <ConfidenceSection
        design={draft.design}
        busy={busy}
        onBack={() => void run(() => save({ ...draft, circle: undefined, step: "interview" }))}
        onClose={close}
        onDone={(design) =>
          void run(async () => {
            // A lighter plan taken here changes the weekly target (and, for a route, the finish date).
            const facts = designedFacts(design);
            await save({
              ...applyFacts(draft, facts),
              design,
              interview: { ...interview, facts: { ...interview.facts, ...facts, baseline: design.baseline.text } },
              step: "interview-finish",
            });
          })
        }
      />
    );

  // ── The paywall ───────────────────────────────────────────────────────────

  const backToConfidence = () =>
    void run(async () => {
      setAwaitingUpgrade(false);
      await save({ ...draft, step: "confidence", awaitingUpgrade: false });
    });
  const checkout = () =>
    void run(async () => {
      if (!selectedPlan?.url) return;
      // Recheck first, so an existing or newly confirmed subscription is never started twice.
      if ((await currentPlanType()) !== "FREE") return complete(true);
      await save({ ...draft, awaitingUpgrade: true });
      posthog?.capture("purchase-started", { placement: "onboarding", store: "stripe", plan: selectedPlan.id });
      setAwaitingUpgrade(true);
      // A new tab keeps this screen waiting; if the browser blocks it, go to checkout here.
      if (!window.open(selectedPlan.url, "_blank", "noopener")) window.location.assign(selectedPlan.url);
    });
  const restore = () =>
    void run(async () => {
      if ((await currentPlanType()) !== "FREE") return complete(true);
      throw new Error("No active subscription found for this account.");
    });
  const free = () => void run(() => complete(false));
  const coachPaywall = !paid && !awaitingUpgrade && plans.length > 0;

  return (
    <OnboardingFrame
      screenKey={`paywall-${coachPaywall}-${awaitingUpgrade}`}
      progress={progressFor(screen)}
      busy={busy}
      onBack={backToConfidence}
      onClose={close}
      actions={
        paid ? (
          <>
            <OnboardingButton label="Start with my coach" busy={busy} onClick={() => void run(() => complete(true))} />
            <QuietButton label="Continue with free tracking" disabled={busy} onClick={free} />
          </>
        ) : awaitingUpgrade ? (
          <>
            <p className="text-center text-[13px] text-muted-foreground">Checking your subscription. We’ll open your plan as soon as access is confirmed.</p>
            <QuietButton label="Check subscription again" disabled={busy} onClick={() => void run(() => checkUpgrade.current())} />
            <QuietButton label={`Continue without ${coach}`} variant="link" disabled={busy} onClick={free} />
          </>
        ) : coachPaywall ? (
          <>
            <OnboardingButton label={paywallCta(selectedPlan)} busy={busy} disabled={!selectedPlan} onClick={checkout} />
            {/* Free stays available, but quietly: the paywall is about the coach. */}
            <QuietButton label={`Continue without ${coach}`} variant="link" disabled={busy} onClick={free} />
            <nav className="flex justify-center gap-6 text-xs text-muted-foreground">
              <a href="https://tracking.so/terms" target="_blank" rel="noreferrer">
                Terms
              </a>
              <button type="button" onClick={restore}>
                Restore
              </button>
              <a href="https://tracking.so/privacy" target="_blank" rel="noreferrer">
                Privacy
              </a>
            </nav>
          </>
        ) : (
          <OnboardingButton label="Continue with free tracking" busy={busy || offer.isLoading} onClick={free} />
        )
      }
    >
      {coachPaywall ? (
        <Paywall facts={interview.facts} plans={plans} selected={selectedPlan!.id} onSelect={setPlanId} coach={coach} />
      ) : (
        <ScreenHeading
          title={paid ? "Your plan is ready." : "Your plan is ready. Your coach is next."}
          detail={
            paid
              ? "Set up the first week with your coach, or keep this plan as free tracking."
              : awaitingUpgrade
                ? "Finish checkout in the new tab. This page continues on its own."
                : offer.isError
                  ? "Coaching checkout isn’t available right now. You can start tracking for free and add coaching later."
                  : "Start your trial to set up the first week with your coach. Or keep this plan and track it for free."
          }
        />
      )}
      {errorLine}
    </OnboardingFrame>
  );
}

/** Runs once, the first time `when` is true. */
function useEffectOnce(effect: () => void, when: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    effect();
  });
}
