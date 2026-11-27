import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { OnboardingFrame } from "@/components/onboarding/frame/OnboardingFrame";
import { CoachAvatar, OnboardingButton, QuietButton } from "@/components/onboarding/frame/controls";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useCurrentUser } from "@/contexts/users";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { dayLabel, endQuiet, nextTurn, openingQuestion, pausePlan, saveLogDraft } from "./service";
import type { TalkAnswered, TalkLogDraft, TalkToCoachSearch, TalkTurn } from "./types";

/** Screens in a conversation: at most two questions, then the coach's last word. */
const SCREENS = 3;

/**
 * Talk to coach: one screen per turn, like onboarding (same as the iPhone app). The coach writes each
 * screen; the person answers in their own words or by voice. Nothing is sent in their name.
 */
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TalkToCoach({ planId, reason, missed }: TalkToCoachSearch) {
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
      return { next: await nextTurn(api, planId, { reason, turns, notSure, missed }), turns };
    },
    onSuccess: ({ next, turns }) => {
      setAnswered(turns);
      setTurn(next);
      setAnswer("");
    },
  });
  const undo = useMutation({ mutationFn: () => endQuiet(api, planId), onSuccess: close });
  // "Pause until …" and "Log it" on the coach's card act right here, then the screen says what changed.
  const pause = useMutation({ mutationFn: (until: string) => pausePlan(api, planId, until), onSuccess: () => void client.invalidateQueries() });
  const save = useMutation({ mutationFn: (draft: TalkLogDraft) => saveLogDraft(api, planId, draft), onSuccess: () => void client.invalidateQueries() });
  // A picked reason goes straight to the coach; "Something else" waits for the person's words.
  useEffect(() => {
    if (!turn) ask.mutate({ text: "", notSure: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = ask.isPending || undo.isPending || pause.isPending || save.isPending;
  const done = turn?.ask === "none";
  const error = ask.error ?? undo.error ?? pause.error ?? save.error;
  const draft = turn?.logIt ? turn.logDraft : null;
  const paused = pause.data?.until;
  return (
    <OnboardingFrame
      screenKey={`talk-${answered.length}-${turn?.say ?? "waiting"}`}
      progress={{ current: done ? SCREENS : Math.min(SCREENS - 1, answered.length + 1), total: SCREENS }}
      busy={busy}
      onClose={close}
      actions={
        !turn ? null : done && draft && !save.isSuccess ? (
          <>
            <OnboardingButton label="Log it" busy={save.isPending} onClick={() => save.mutate(draft)} disabled={busy} />
            <QuietButton label="Not quite, I'll log it myself" variant="link" disabled={busy} onClick={() => navigate({ to: "/add" })} />
          </>
        ) : done && turn.pauseUntil && !paused ? (
          <>
            <OnboardingButton label={`Pause until ${dayLabel(turn.pauseUntil)}`} busy={pause.isPending} onClick={() => pause.mutate(turn.pauseUntil!)} disabled={busy} />
            <QuietButton label="Keep it running" variant="link" disabled={busy} onClick={close} />
          </>
        ) : done && turn.logIt && !draft ? (
          <>
            <OnboardingButton label="Log it" onClick={() => navigate({ to: "/add" })} disabled={busy} />
            <QuietButton label="Later" variant="link" disabled={busy} onClick={close} />
          </>
        ) : done ? (
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
        {/* The coach is the one talking. Helly gives a thumbs-up once when you commit to a day. */}
        {turn?.commitment && coach.name !== "Oli" && !reducedMotion() ? (
          <img data-testid="talk-coach-thumbs-up" src="/images/onboarding/helly-3d-thumbs-up.webp" alt="" style={{ width: 112, height: 112 }} className="object-contain" />
        ) : (
          <CoachAvatar coach={coach.name === "Oli" ? "Oli" : "Helly"} size={112} />
        )}
        {turn ? (
          <h1 data-testid="talk-say" className="text-balance text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">
            {turn.say}
          </h1>
        ) : (
          !error && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={`${coach.name} is thinking`} />
        )}
        {turn?.detail && !paused && <p data-testid="talk-detail" className="text-[17px] leading-[25px] text-muted-foreground">{turn.detail}</p>}
        {paused && (
          <p data-testid="talk-paused" className="text-[17px] leading-[25px] text-muted-foreground">
            Paused through {dayLabel(paused)}. It picks up again the day after, and I'll check in that morning.
          </p>
        )}
        {draft && <LogDraftCard draft={draft} saved={save.isSuccess} />}
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

const MAX_ROWS = 4;
const when = (day: string) => {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();
  return day === key(today) ? "Today" : day === key(new Date(today.getTime() - 86_400_000)) ? "Yesterday" : dayLabel(day);
};

/** What the coach understood from their words, about to be logged: one row per session, like a log card. */
function LogDraftCard({ draft, saved }: { draft: TalkLogDraft; saved: boolean }) {
  const rows = [...draft.activities].sort((a, b) => a.date.localeCompare(b.date));
  const shown = rows.slice(-MAX_ROWS);
  return (
    <div data-testid="talk-log-draft" className="w-full rounded-2xl border border-border bg-card px-4 py-1.5 text-left">
      {shown.map((a, i) => (
        <div key={`${a.activityId}-${a.date}`} className={`flex items-center gap-3.5 py-3 ${i ? "border-t border-border" : ""}`}>
          <span className="text-[30px] leading-none">{a.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-foreground">{a.title}</p>
            <p className="text-[15px] text-muted-foreground">
              {a.quantity} {a.measure} · {when(a.date)}
            </p>
          </div>
          {saved && <Check className="h-5 w-5 text-green-600" aria-label="Logged" />}
        </div>
      ))}
      {rows.length > shown.length && <p className="pb-2.5 text-sm text-muted-foreground">+{rows.length - shown.length} earlier days</p>}
    </div>
  );
}
