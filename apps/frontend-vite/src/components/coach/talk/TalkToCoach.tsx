import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { OnboardingFrame } from "@/components/onboarding/frame/OnboardingFrame";
import { CoachAvatar, OnboardingButton, QuietButton } from "@/components/onboarding/frame/controls";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { endQuiet, nextTurn, openingQuestion } from "./service";
import type { TalkAnswered, TalkToCoachSearch, TalkTurn } from "./types";

/** Screens in a conversation: at most two questions, then the coach's last word. */
const SCREENS = 3;

/**
 * Talk to coach: one screen per turn, like onboarding (same as the iPhone app). The coach writes each
 * screen; the person answers in their own words or by voice. Nothing is sent in their name.
 */
export function TalkToCoach({ planId, reason }: TalkToCoachSearch) {
  const api = useApiWithAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const [answered, setAnswered] = useState<TalkAnswered[]>([]);
  const [turn, setTurn] = useState<TalkTurn | null>(() => openingQuestion(reason));
  const [answer, setAnswer] = useState("");
  const close = () => {
    void client.invalidateQueries();
    navigate({ to: "/coach" });
  };
  const ask = useMutation({
    mutationFn: async ({ text, notSure }: { text: string; notSure: boolean }) => {
      const turns = turn ? [...answered, { say: turn.say, answer: notSure ? "Not sure yet" : text }] : answered;
      return { next: await nextTurn(api, planId, { reason, turns, notSure }), turns };
    },
    onSuccess: ({ next, turns }) => {
      setAnswered(turns);
      setTurn(next);
      setAnswer("");
    },
  });
  const undo = useMutation({ mutationFn: () => endQuiet(api, planId), onSuccess: close });
  // A picked reason goes straight to the coach; "Something else" waits for the person's words.
  useEffect(() => {
    if (!turn) ask.mutate({ text: "", notSure: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = ask.isPending || undo.isPending;
  const done = turn?.ask === "none";
  const error = ask.error ?? undo.error;
  return (
    <OnboardingFrame
      screenKey={`talk-${answered.length}-${turn?.say ?? "waiting"}`}
      progress={{ current: done ? SCREENS : Math.min(SCREENS - 1, answered.length + 1), total: SCREENS }}
      busy={busy}
      onClose={close}
      actions={
        !turn ? null : done ? (
          <>
            <OnboardingButton label="Continue" onClick={close} disabled={busy} />
            {turn.quietUntil && <QuietButton label="Keep nudging me" variant="link" disabled={busy} onClick={() => undo.mutate()} />}
          </>
        ) : (
          <>
            <OnboardingButton
              label="Send"
              busy={ask.isPending}
              disabled={!answer.trim()}
              onClick={() => ask.mutate({ text: answer.trim(), notSure: false })}
            />
            <QuietButton label="Not sure yet" variant="link" disabled={busy} onClick={() => ask.mutate({ text: "", notSure: true })} />
          </>
        )
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <CoachAvatar coach={coach.name === "Oli" ? "Oli" : "Helly"} size={72} />
        {turn ? (
          <h1 data-testid="talk-say" className="text-balance text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">
            {turn.say}
          </h1>
        ) : (
          !error && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={`${coach.name} is thinking`} />
        )}
        {turn?.detail && <p data-testid="talk-detail" className="text-[17px] leading-[25px] text-muted-foreground">{turn.detail}</p>}
        {turn?.ask === "text" && (
          <div className="w-full text-left">
            <TextAreaWithVoice
              value={answer}
              onChange={setAnswer}
              showHint={false}
              placeholder={turn.placeholder || "In your own words"}
              className="!min-h-[120px] rounded-2xl border-border bg-card p-[18px] !text-[17px] leading-6 md:!text-[17px]"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{toApiErrorMessage(error)}</p>}
        {error && !turn && <QuietButton label="Try again" variant="link" onClick={() => ask.mutate({ text: "", notSure: false })} />}
      </div>
    </OnboardingFrame>
  );
}
