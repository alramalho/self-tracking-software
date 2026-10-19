import { CheckCircle2, CircleAlert } from "lucide-react";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { OnboardingArt, ScreenHeading } from "../frame/controls";
import type { GoalGuidanceProps, QuestionStepProps } from "../types";

// One question, answered in their own words (typed or spoken), with the coach's check underneath.
export function QuestionStep({ stage, title, answer, onAnswer, guidance, checking }: QuestionStepProps) {
  return (
    <>
      <ScreenHeading art={<OnboardingArt name={stage} size={150} />} title={title} />
      <div className="flex flex-col gap-3">
        <TextAreaWithVoice
          value={answer}
          onChange={onAnswer}
          showHint={false}
          placeholder={stage === "goal" ? "I’d love to…" : "In your own words…"}
          className="!min-h-[132px] rounded-2xl border-border bg-card p-[18px] !text-[17px] leading-[25px] md:!text-[17px]"
        />
        {answer.trim().length >= 3 && <GoalGuidance result={guidance} loading={checking} />}
      </div>
    </>
  );
}

function GoalGuidance({ result, loading }: GoalGuidanceProps) {
  const check = result.requirements[0];
  if (!check) return null;
  const Icon = check.passed ? CheckCircle2 : CircleAlert;
  return (
    <div aria-label="Answer check" data-testid="goal-guidance" className="flex items-center gap-2">
      <Icon className={`h-[17px] w-[17px] shrink-0 ${check.passed ? "text-emerald-500" : "text-muted-foreground"}`} />
      <span className={`text-[13px] leading-[19px] ${check.passed ? "text-foreground" : "text-muted-foreground"}`}>
        {loading ? "Checking your answer…" : check.detail}
      </span>
    </div>
  );
}
