import { useState, type ReactNode } from "react";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { days } from "../design/format";
import { CoachAvatar, OnboardingButton, QuietButton } from "../frame/controls";
import { OnboardingFrame } from "../frame/OnboardingFrame";
import { TOTAL_STEPS } from "../model";
import type { ConfidenceSectionProps, ConfidenceStepName } from "../types";
import { applyLighter, CONFIDENT, confidenceFor, FIRST_SCORE, lighterMessage, lighterPlan, whyQuestion } from "./confidence";
import { ConfidenceDial } from "./ConfidenceDial";

// The last thing asked before the plan starts: how sure the person is of it (1–10), a lighter
// plan when they aren't, then "why not lower?" in their own words.
export function ConfidenceSection({ design: initial, busy, onBack, onClose, onDone }: ConfidenceSectionProps) {
  const [design, setDesign] = useState(initial);
  const [step, setStep] = useState<ConfidenceStepName>("rate");
  const [score, setScore] = useState(initial.confidence?.score ?? FIRST_SCORE);
  const [why, setWhy] = useState(initial.confidence?.why ?? "");
  const [offered, setOffered] = useState(false);
  const activity = design.activities[0];
  const chosen = design.options.find((option) => option.id === design.selected);
  const lighter = lighterPlan(design);
  const question = whyQuestion(score);
  const finish = (answer: string) => onDone({ ...design, confidence: confidenceFor(score, answer, question) });

  let body: ReactNode;
  let actions: ReactNode;
  if (step === "rate") {
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-balance text-[30px] font-bold leading-9 tracking-[-0.02em] text-foreground">How sure are you that you’ll stick to this?</h1>
        <p className="text-[15px] text-muted-foreground">
          {chosen
            ? `${activity.emoji} ${chosen.coach} · ${days(chosen)} days a week`
            : `${activity.emoji} ${activity.title} · ${design.preferredDays} times a week`}
        </p>
        <ConfidenceDial score={score} onChange={setScore} />
      </div>
    );
    actions = (
      <OnboardingButton
        label="Continue"
        disabled={busy}
        onClick={() => setStep(score < CONFIDENT && lighter && !offered ? "lighter" : "why")}
      />
    );
  } else if (step === "lighter" && lighter) {
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        <CoachAvatar coach="Helly" size={104} />
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em] text-foreground">Let’s make it a plan you’re sure of</h1>
        <p data-testid="lighter-message" className="text-[17px] leading-[25px] text-muted-foreground">
          {lighterMessage(lighter)}
        </p>
      </div>
    );
    actions = (
      <>
        <OnboardingButton
          label="Make it lighter"
          disabled={busy}
          onClick={() => {
            // Rate the lighter plan again: the number should be about the plan they'll actually do.
            setDesign(applyLighter(design, lighter));
            setOffered(true);
            setStep("rate");
          }}
        />
        <QuietButton
          label="Keep this plan"
          variant="link"
          onClick={() => {
            setOffered(true);
            setStep("why");
          }}
        />
      </>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        <ConfidenceDial score={score} compact />
        {/* Keep the number with the word before it, so "7?" never sits alone on a line. */}
        <h1 className="text-[30px] font-bold leading-9 tracking-[-0.02em] text-foreground">{question.replace(/ (\S+)$/, " $1")}</h1>
        <p className="text-[15px] leading-[21px] text-muted-foreground">Say it out loud. Your coach keeps it for the hard days.</p>
        <div className="w-full text-left">
          <TextAreaWithVoice
            value={why}
            onChange={setWhy}
            showHint={false}
            placeholder="In your own words"
            className="!min-h-[120px] rounded-2xl border-border bg-card p-[18px] !text-[17px] leading-6 md:!text-[17px]"
          />
        </div>
      </div>
    );
    actions = <OnboardingButton label="Continue" disabled={!why.trim() || busy} onClick={() => finish(why)} />;
  }

  return (
    <OnboardingFrame
      screenKey={`confidence-${step}-${design.selected}-${design.preferredDays}`}
      progress={{ current: 11.5, total: TOTAL_STEPS }}
      busy={busy}
      onBack={step === "rate" ? onBack : () => setStep("rate")}
      onClose={onClose}
      onSkip={step === "why" ? () => finish("") : undefined}
      actions={actions}
    >
      {body}
    </OnboardingFrame>
  );
}
