import { useState } from "react";
import { Image, Pressable } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
import { InterviewFrame } from "../interview/Frame";
import { OnboardingButton } from "../interview/OnboardingButton";
import { StepSequence } from "../interview/StepReveal";
import { CONFIDENT, FIRST_SCORE, applyLighter, confidenceFor, lighterMessage, lighterPlan, voiceLevel, whyQuestion } from "./confidence";
import { ConfidenceDial } from "./ConfidenceDial";
import { days } from "./RouteCard";
import type { ConfidenceSectionProps, ConfidenceStepName } from "./types";

// The last thing asked before the plan starts, once everything about it is settled: how sure the person
// is of it (1–10), a lighter plan when they aren't, then "why not lower?" in their own words.
export function ConfidenceSection({ design: initial, progress, preview, busy, onBack, onClose, onDone }: ConfidenceSectionProps) {
  const c = useColors();
  const [design, setDesign] = useState(initial);
  const [step, setStep] = useState<ConfidenceStepName>("rate");
  const [score, setScore] = useState(initial.confidence?.score ?? FIRST_SCORE);
  const [why, setWhy] = useState(initial.confidence?.why ?? "");
  const [voice, setVoice] = useState(0);
  const [offered, setOffered] = useState(false);
  const activity = design.activities[0];
  const chosen = design.options.find((o) => o.id === design.selected);
  const lighter = lighterPlan(design);
  const question = whyQuestion(score);
  const finish = (answer: string) => onDone({ ...design, confidence: confidenceFor(score, answer, question) });

  const back = () => {
    if (step === "rate") return onBack();
    setStep("rate");
  };

  let body;
  let actions;
  if (step === "rate") {
    body = (
      <StepSequence prefix="confidence-rate" style={{ alignItems: "center", gap: 18 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          How sure are you that you’ll stick to this?
        </Text>
        <Text style={{ color: c.muted, fontSize: 15, textAlign: "center" }}>
          {chosen ? `${activity.emoji} ${chosen.coach} · ${days(chosen)} days a week` : `${activity.emoji} ${activity.title} · ${design.preferredDays} times a week`}
        </Text>
        <ConfidenceDial score={score} onChange={setScore} />
      </StepSequence>
    );
    actions = (
      <OnboardingButton
        label="Continue"
        disabled={busy}
        onPress={() => setStep(score < CONFIDENT && lighter && !offered ? "lighter" : "why")}
      />
    );
  } else if (step === "lighter" && lighter) {
    body = (
      <StepSequence prefix="confidence-lighter" style={{ alignItems: "center", gap: 18 }}>
        <Image source={require("../../../../assets/coaches/helly-3d.png")} style={{ width: 104, height: 104 }} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 }}>
          Let’s make it a plan you’re sure of
        </Text>
        <Text testID="lighter-message" style={{ color: c.muted, fontSize: 17, lineHeight: 25, textAlign: "center" }}>{lighterMessage(lighter)}</Text>
      </StepSequence>
    );
    actions = (
      <>
        <OnboardingButton
          label="Make it lighter"
          disabled={busy}
          onPress={() => {
            // Rate the lighter plan again: the number should be about the plan they'll actually do.
            setDesign(applyLighter(design, lighter));
            setOffered(true);
            setStep("rate");
          }}
        />
        <Pressable accessibilityRole="button" onPress={() => { setOffered(true); setStep("why"); }} style={{ alignItems: "center", paddingVertical: 6 }}>
          <Text style={{ color: c.muted, fontSize: 15, textDecorationLine: "underline" }}>Keep this plan</Text>
        </Pressable>
      </>
    );
  } else {
    body = (
      <StepSequence prefix="confidence-why" style={{ alignItems: "center", gap: 16 }}>
        <ConfidenceDial score={score} compact voice={voice} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {/* Keep the number with the word before it, so "7?" never sits alone on a line. */}
          {question.replace(/ (\S+)$/, "\u00a0$1")}
        </Text>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21, textAlign: "center" }}>Say it out loud. Your coach keeps it for the hard days.</Text>
        <VoiceTextArea
          testID="confidence-why"
          accessibilityLabel="Your answer"
          dictationLabel="answer"
          value={why}
          onChangeText={setWhy}
          onDictationLevel={(db) => setVoice(voiceLevel(db))}
          placeholder="In your own words"
          placeholderTextColor={c.muted}
          wrapperStyle={{ alignSelf: "stretch" }}
          style={{ minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, padding: 18, fontSize: 17, lineHeight: 24, color: c.text }}
        />
      </StepSequence>
    );
    actions = <OnboardingButton label="Continue" disabled={!why.trim() || busy} onPress={() => finish(why)} />;
  }
  return (
    <InterviewFrame
      stage="review"
      transitionKey={`confidence-${step}-${design.selected}-${design.preferredDays}`}
      progress={progress}
      preview={preview}
      busy={busy}
      onBack={back}
      onClose={onClose}
      onSkip={step === "why" ? () => finish("") : undefined}
      actions={actions}
    >
      {body}
    </InterviewFrame>
  );
}
