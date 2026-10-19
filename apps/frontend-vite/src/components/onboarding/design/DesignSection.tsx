import type { DesignOption, PlanDesign, SubgoalQuestion } from "@tsw/prisma/follow-through";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useThemeColors } from "@/hooks/useThemeColors";
import { designRoutes, errorMessage, nextSubgoal } from "../api";
import { CoachAvatar, NumberPicker, OnboardingArt, OnboardingButton, QuietButton, ScreenHeading } from "../frame/controls";
import { OnboardingFrame } from "../frame/OnboardingFrame";
import { TOTAL_STEPS } from "../model";
import type { DesignSectionProps, DesignStepName } from "../types";
import { days } from "./format";
import { RouteCard } from "./RouteCard";
import { TwoWeeks } from "./TwoWeeks";

const DECLINE = "No target in mind";

function firstStep(design: PlanDesign): DesignStepName {
  if (design.selected) return "preview";
  if (design.options.length) return "options";
  return design.orientation === "OUTCOME" && !design.asked.length ? "subgoal" : "days";
}

// "Your week". Outcome: [one optional question] → days → two routes → the first two weeks.
// Habit: the weekly count only. One simple ask per screen, as in the app.
export function DesignSection({ design, goal, goalReason, timezone, busy, onChange, onBack, onClose, onDone }: DesignSectionProps) {
  const theme = useThemeColors();
  const outcome = design.orientation === "OUTCOME";
  const [step, setStep] = useState<DesignStepName>(() => firstStep(design));
  const [question, setQuestion] = useState<SubgoalQuestion | null>(null);
  const [asking, setAsking] = useState("");
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const requested = useRef(false);
  const activity = design.activities[0];
  const chosen = design.options.find((option) => option.id === design.selected);

  // The coach may ask one more thing about the goal; most of the time there's nothing to add.
  useEffect(() => {
    if (step !== "subgoal" || question || requested.current) return;
    requested.current = true;
    setWorking(true);
    nextSubgoal(design, goal, design.baseline.text)
      .then((next) => (next ? setQuestion(next) : setStep("days")))
      .catch((e) => {
        setError(errorMessage(e));
        requested.current = false;
      })
      .finally(() => setWorking(false));
  }, [step, question, design, goal]);

  const fail = (e: unknown) => setError(errorMessage(e));

  async function answerSubgoal(answer: string) {
    if (!question) return;
    const declined = answer === DECLINE || /^(just|no )/i.test(answer);
    const next: PlanDesign = {
      ...design,
      asked: [...design.asked, { question: question.title, answer }],
      goalSpec: declined ? design.goalSpec : { metric: question.kind, value: null, unit: null, text: answer, chosenByUser: true },
    };
    await onChange(next);
    setQuestion(null);
    setTyped("");
    setTyping(false);
    requested.current = false;
    // Ask again only if the coach still needs something and the person hasn't declined.
    setStep(declined || next.asked.length >= 2 ? "days" : "subgoal");
  }

  async function generate(from: PlanDesign) {
    setError(null);
    if (!outcome) return onDone(from);
    setStep("loading");
    try {
      // Why it matters is context for the coach's tone, not something to store as an answer twice.
      const context = goalReason ? [...from.asked, { question: "Why does it matter?", answer: goalReason }] : from.asked;
      const result = await designRoutes({ ...from, asked: context.slice(-4) }, goal, timezone);
      if (result.status === "ASK" && result.question) {
        setAsking(result.question);
        setStep("ask");
        return;
      }
      if (result.status === "PUSHBACK") {
        await onChange({ ...from, coachNote: result.coachNote, options: [], selected: null });
        setStep("pushback");
        return;
      }
      await onChange({ ...from, baseline: result.baseline, options: result.options, startDate: result.startDate, selected: null, coachNote: result.coachNote });
      setStep("options");
    } catch (e) {
      fail(e);
      setStep("days");
    }
  }

  const choose = async (option: DesignOption) => {
    await onChange({ ...design, selected: option.id });
    setStep("preview");
  };

  const back = () => {
    setError(null);
    if (step === "preview") return setStep("options");
    if (step === "options" || step === "ask" || step === "pushback") return setStep("days");
    if (step === "retarget") return setStep("pushback");
    if (step === "days" && outcome && design.asked.length) return setStep("subgoal");
    onBack();
  };

  const anything = busy || working || step === "loading";
  let body: ReactNode = null;
  let actions: ReactNode = null;

  if (step === "subgoal") {
    body = (
      <>
        <ScreenHeading art={<OnboardingArt name="question" size={120} />} title={question?.title ?? "One moment…"} />
        {question && (
          <div className="flex flex-col gap-3">
            {question.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={anything}
                onClick={() => void answerSubgoal(choice).catch(fail)}
                className="flex min-h-[58px] items-center rounded-2xl bg-card px-[18px] text-left text-[17px] font-semibold text-foreground transition-opacity hover:opacity-70 disabled:opacity-60"
              >
                {choice}
              </button>
            ))}
            {typing ? (
              <Input
                id="subgoal-own"
                aria-label="Your own answer"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && typed.trim() && void answerSubgoal(typed.trim()).catch(fail)}
                placeholder="In your own words"
                className="h-[58px] rounded-2xl bg-card px-[18px] text-[17px]"
              />
            ) : (
              <QuietButton label="Write my own" variant="link" onClick={() => setTyping(true)} />
            )}
          </div>
        )}
      </>
    );
    if (typing) actions = <OnboardingButton label="Continue" disabled={!typed.trim() || anything} onClick={() => void answerSubgoal(typed.trim()).catch(fail)} />;
  } else if (step === "days") {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <OnboardingArt name="rhythm" size={150} />
        <h1 className="text-balance text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-foreground">
          {outcome ? "How many days would you prefer?" : "How many times a week?"}
        </h1>
        <NumberPicker
          value={design.preferredDays}
          onChange={(preferredDays) => void onChange({ ...design, preferredDays, options: [], selected: null, coachNote: null }).catch(fail)}
          disabled={anything}
          min={1}
          max={7}
          unit={outcome ? "training days per week" : "times per week"}
          decreaseLabel="Fewer days"
          increaseLabel="More days"
          testId="design-days"
        />
        <p className="text-[15px] leading-[22px] text-muted-foreground">
          {outcome ? "Your coach will check whether this supports your goal." : `${activity.emoji} ${activity.title}`}
        </p>
      </div>
    );
    actions = <OnboardingButton label={outcome ? "Ask my coach" : "Continue"} disabled={anything} onClick={() => void generate(design)} />;
  } else if (step === "ask") {
    body = (
      <>
        <ScreenHeading art={<OnboardingArt name="rhythm" size={130} />} title={asking} />
        <Textarea
          aria-label="Your answer"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="In your own words"
          className="min-h-[100px] rounded-2xl bg-card p-[18px] text-[17px] md:text-[17px]"
        />
      </>
    );
    actions = (
      <OnboardingButton
        label="Continue"
        disabled={!typed.trim() || anything}
        onClick={() => {
          const next = { ...design, asked: [...design.asked, { question: asking, answer: typed.trim() }] };
          setTyped("");
          void onChange(next).then(() => generate(next), fail);
        }}
      />
    );
  } else if (step === "pushback") {
    const note = design.coachNote;
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        <CoachAvatar coach="Helly" size={104} />
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em] text-foreground">A quick reality check</h1>
        <p data-testid="pushback-message" className="text-[17px] leading-[25px] text-muted-foreground">
          {note?.message}
        </p>
      </div>
    );
    actions = (
      <>
        {note?.suggestedDays ? (
          <OnboardingButton
            label={`Use ${note.suggestedDays} days`}
            disabled={anything}
            onClick={() => {
              const next = { ...design, preferredDays: note.suggestedDays!, coachNote: null };
              void onChange(next).then(() => generate(next), fail);
            }}
          />
        ) : (
          <OnboardingButton label="Change my days" disabled={anything} onClick={() => setStep("days")} />
        )}
        {note?.targetInvolved && (
          <QuietButton
            label="Change my target"
            disabled={anything}
            onClick={() => {
              setTyped("");
              setStep("retarget");
            }}
          />
        )}
        {note?.suggestedDays ? <QuietButton label="Change my days" variant="link" onClick={() => setStep("days")} /> : null}
      </>
    );
  } else if (step === "retarget") {
    const apply = (text: string | null) => {
      const next: PlanDesign = {
        ...design,
        coachNote: null,
        asked: [...design.asked, { question: "What would you like to aim for instead?", answer: text ?? "Just finish, no target" }].slice(-4),
        goalSpec: text
          ? { ...design.goalSpec, text, value: null, unit: null, chosenByUser: true }
          : { metric: null, value: null, unit: null, text: null, chosenByUser: false },
      };
      void onChange(next).then(() => generate(next), fail);
    };
    body = (
      <>
        <ScreenHeading art={<OnboardingArt name="question" size={120} />} title="What would you like to aim for?" />
        <Input
          id="retarget-input"
          aria-label="Your new target"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="In your own words"
          className="h-[58px] rounded-2xl bg-card px-[18px] text-[17px]"
        />
      </>
    );
    actions = (
      <>
        <OnboardingButton label="Ask my coach" disabled={!typed.trim() || anything} onClick={() => apply(typed.trim())} />
        <QuietButton label="Just finish, no target" disabled={anything} onClick={() => apply(null)} />
      </>
    );
  } else if (step === "loading") {
    body = <Planning />;
  } else if (step === "options") {
    body = (
      <div className="flex flex-col gap-3.5">
        <div className="mb-1.5 flex flex-col items-center gap-2.5 text-center">
          <OnboardingArt name="review" size={130} />
          <h1 className="text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-foreground">Choose your plan</h1>
          <p className="text-base text-muted-foreground">Same goal. Two ways to get there.</p>
        </div>
        {design.coachNote?.verdict === "ADJUSTED" && design.coachNote.message && (
          <div data-testid="coach-note" className="flex items-center gap-3 rounded-[18px] bg-card p-3.5">
            <CoachAvatar coach="Helly" size={40} />
            <p className="flex-1 text-[15px] leading-[21px] text-foreground">{design.coachNote.message}</p>
          </div>
        )}
        {design.options.map((option) => (
          <RouteCard key={option.id} option={option} selected={design.selected === option.id} onClick={() => void choose(option).catch(fail)} />
        ))}
        <QuietButton label="More / fewer days" variant="link" onClick={() => setStep("days")} />
      </div>
    );
  } else if (chosen) {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-2.5">
          <Check className={`h-[18px] w-[18px] ${theme.text}`} />
          <h1 className="text-xl font-bold text-foreground">
            {chosen.coach} · {days(chosen)} days per week
          </h1>
        </div>
        <TwoWeeks sessions={chosen.sessions} activity={activity} startDate={design.startDate} />
        <QuietButton label="Choose the other plan" variant="link" onClick={() => setStep("options")} />
      </div>
    );
    actions = <OnboardingButton label="Continue" disabled={busy} onClick={() => onDone(design)} />;
  }

  return (
    <OnboardingFrame
      screenKey={`design-${step}-${design.asked.length}-${design.selected}`}
      progress={{ current: step === "options" ? 5 : step === "preview" ? 6 : 4, total: TOTAL_STEPS }}
      busy={anything}
      onBack={back}
      onClose={onClose}
      onSkip={step === "subgoal" && question ? () => void answerSubgoal(DECLINE).catch(fail) : undefined}
      actions={actions}
    >
      {body}
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </OnboardingFrame>
  );
}

// Helly and Oli at work while the two routes are built.
function Planning() {
  return (
    <div data-testid="design-loading" className="flex flex-col items-center gap-5 text-center">
      <motion.div
        className="flex gap-4"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <CoachAvatar coach="Helly" size={96} />
        <CoachAvatar coach="Oli" size={96} />
      </motion.div>
      <h1 className="text-[28px] font-bold leading-[34px] text-foreground">Planning your two routes</h1>
    </div>
  );
}
