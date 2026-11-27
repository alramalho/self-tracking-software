import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
import { InterviewFrame } from "@/features/onboarding/interview/Frame";
import { OnboardingButton } from "@/features/onboarding/interview/OnboardingButton";
import { StepSequence } from "@/features/onboarding/interview/StepReveal";
import { coachIdentity } from "@/features/messages/coach";
import { hellyThumbsUp } from "@/features/coach/avatar";
import { dismissPlanNotifications } from "@/native/notifications/dismiss";
import { VoiceLogDrawer } from "@/features/voice-log/VoiceLogDrawer";
import { voiceLogActivityKey } from "@/features/voice-log/types";
import { usePlan } from "@/data/queries";
import { dayLabel, endQuiet, nextTurn, openingQuestion, pausePlan } from "./service";
import { LogDraftCard } from "./LogDraftCard";
import type { TalkAnswered, TalkToCoachProps, TalkTurn } from "./types";

/** Screens in a conversation: at most two questions, then the coach's last word. */
const SCREENS = 3;

/**
 * Talk to coach: one screen per turn, like onboarding. The coach writes each screen (a line, maybe one
 * question); the person answers in their own words or by voice. Nothing is sent in their name.
 */
export function TalkToCoach({ planId, reason, missed }: TalkToCoachProps) {
  const c = useColors();
  const client = useQueryClient();
  const personality = useCurrentUser().data?.coachPersonality;
  const coach = coachIdentity(personality);
  const [answered, setAnswered] = useState<TalkAnswered[]>([]);
  const [turn, setTurn] = useState<TalkTurn | null>(() => openingQuestion(reason));
  const [answer, setAnswer] = useState("");
  // "Log it": the sessions they already said are saved ("card"), or the voice note asks what they did ("voice").
  const [logging, setLogging] = useState<"card" | "voice" | null>(null);
  // "Pause until …" tapped: the plan is paused through this day.
  const [paused, setPaused] = useState<string | null>(null);
  const plan = usePlan(planId).data;
  const ask = useMutation({
    mutationFn: async ({ text, notSure }: { text: string; notSure: boolean }) => {
      const turns = turn ? [...answered, { say: turn.say, answer: notSure ? "Not sure yet" : text }] : answered;
      return { next: await nextTurn(planId, { reason, turns, notSure, missed }), turns };
    },
    onSuccess: ({ next, turns }) => {
      // The last screen: the server has answered the alert, so its notification goes too.
      if (next.ask === "none") void dismissPlanNotifications(planId);
      setAnswered(turns);
      setTurn(next);
      setAnswer("");
    },
  });
  const undo = useMutation({ mutationFn: () => endQuiet(planId), onSuccess: () => close() });
  const pause = useMutation({
    mutationFn: (until: string) => pausePlan(planId, until),
    onSuccess: ({ until }) => {
      setPaused(until);
      // The plan card and calendar show the pause straight away.
      void client.invalidateQueries();
    },
  });
  // A picked reason goes straight to the coach; "Something else" waits for the person's words.
  useEffect(() => {
    if (!turn) ask.mutate({ text: "", notSure: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => {
    void client.invalidateQueries({ queryKey: ["follow-through"] });
    router.back();
  };
  const busy = ask.isPending || undo.isPending || pause.isPending;
  const draft = turn?.logIt ? turn.logDraft : null;
  const done = turn?.ask === "none";
  const reduced = useReducedMotion();
  const approving = !!turn?.commitment && personality !== "STRATEGIST" && !reduced;
  const send = () => answer.trim() && ask.mutate({ text: answer.trim(), notSure: false });
  return (
    <InterviewFrame
      stage="goal"
      transitionKey={`talk-${answered.length}-${turn?.say ?? "waiting"}`}
      progress={{ current: done ? SCREENS : Math.min(SCREENS - 1, answered.length + 1), total: SCREENS, label: "Talk to coach" }}
      preview={false}
      busy={busy}
      onClose={close}
      actions={
        !turn ? null : done && turn.logIt && draft ? (
          <>
            <OnboardingButton label="Log it" onPress={() => setLogging("card")} disabled={busy} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setLogging("voice")} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: c.muted, fontSize: 15 }}>Not quite, I'll say it</Text>
            </Pressable>
          </>
        ) : done && turn.logIt ? (
          <>
            <OnboardingButton label="Log it" onPress={() => setLogging("voice")} disabled={busy} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: c.muted, fontSize: 15 }}>Later</Text>
            </Pressable>
          </>
        ) : done && turn.pauseUntil && !paused ? (
          <>
            <OnboardingButton
              label={`Pause until ${dayLabel(turn.pauseUntil)}`}
              busy={pause.isPending}
              onPress={() => pause.mutate(turn.pauseUntil!)}
              disabled={busy}
            />
            <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: c.muted, fontSize: 15 }}>Keep it running</Text>
            </Pressable>
          </>
        ) : done ? (
          <>
            <OnboardingButton label="Continue" onPress={close} disabled={busy} />
            {turn.quietUntil && (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => undo.mutate()} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: c.muted, fontSize: 15 }}>Keep nudging me</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <OnboardingButton label="Send" busy={ask.isPending} disabled={!answer.trim()} onPress={send} />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => ask.mutate({ text: "", notSure: true })}
              style={{ alignItems: "center", paddingVertical: 6 }}
            >
              <Text style={{ color: c.muted, fontSize: 15 }}>Not sure yet</Text>
            </Pressable>
          </>
        )
      }
    >
      <StepSequence prefix="talk" style={{ alignItems: "center", gap: 16 }}>
        {/* The coach is the one talking. Helly gives a thumbs-up once when you commit to a day. */}
        <Image
          testID={approving ? "talk-coach-thumbs-up" : "talk-coach"}
          source={approving ? hellyThumbsUp : coach.avatar}
          accessibilityLabel={coach.name}
          contentFit="contain"
          style={{ width: 112, height: 112 }}
        />
        {turn ? (
          <Text testID="talk-say" accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 }}>
            {turn.say}
          </Text>
        ) : (
          <ActivityIndicator color={c.muted} accessibilityLabel={`${coach.name} is thinking`} />
        )}
        {!!turn?.detail && !paused && <Text testID="talk-detail" style={{ color: c.muted, fontSize: 17, lineHeight: 25, textAlign: "center" }}>{turn.detail}</Text>}
        {paused && (
          <Text testID="talk-paused" style={{ color: c.muted, fontSize: 17, lineHeight: 25, textAlign: "center" }}>
            Paused through {dayLabel(paused)}. It picks up again the day after, and I'll check in that morning.
          </Text>
        )}
        {draft && <LogDraftCard draft={draft} />}
        {turn?.ask === "text" && (
          <VoiceTextArea
            testID="talk-answer"
            accessibilityLabel="Your answer"
            dictationLabel="answer"
            value={answer}
            onChangeText={setAnswer}
            placeholder={turn.placeholder || "In your own words"}
            placeholderTextColor={c.muted}
            wrapperStyle={{ alignSelf: "stretch" }}
            style={{ minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, padding: 18, fontSize: 17, lineHeight: 24, color: c.text }}
          />
        )}
        <Status error={ask.error ?? undo.error ?? pause.error} />
        {ask.isError && !turn && (
          <Pressable accessibilityRole="button" onPress={() => ask.mutate({ text: "", notSure: false })} style={{ paddingVertical: 6 }}>
            <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        )}
      </StepSequence>
      {logging && (
        <VoiceLogDrawer
          catchUp={{ planId, activityId: plan?.activities.length === 1 ? plan.activities[0].id : undefined }}
          initialDraft={
            logging === "card" && draft
              ? { preview: draft, selectedActivityKeys: draft.activities.map(voiceLogActivityKey), selectedMetricKeys: [], selectedPlanId: null, savedAt: new Date().toISOString() }
              : undefined
          }
          saveOnOpen={logging === "card"}
          onClose={close}
        />
      )}
    </InterviewFrame>
  );
}
