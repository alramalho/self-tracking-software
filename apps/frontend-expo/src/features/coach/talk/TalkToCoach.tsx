import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable } from "react-native";
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
import { dismissPlanNotifications } from "@/native/notifications/dismiss";
import { endQuiet, nextTurn, openingQuestion } from "./service";
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
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  const [answered, setAnswered] = useState<TalkAnswered[]>([]);
  const [turn, setTurn] = useState<TalkTurn | null>(() => openingQuestion(reason));
  const [answer, setAnswer] = useState("");
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
  // A picked reason goes straight to the coach; "Something else" waits for the person's words.
  useEffect(() => {
    if (!turn) ask.mutate({ text: "", notSure: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => {
    void client.invalidateQueries({ queryKey: ["follow-through"] });
    router.back();
  };
  const busy = ask.isPending || undo.isPending;
  const done = turn?.ask === "none";
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
        !turn ? null : done ? (
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
        <Image source={coach.avatar} accessibilityLabel={coach.name} style={{ width: 72, height: 72 }} />
        {turn ? (
          <Text testID="talk-say" accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 }}>
            {turn.say}
          </Text>
        ) : (
          <ActivityIndicator color={c.muted} accessibilityLabel={`${coach.name} is thinking`} />
        )}
        {!!turn?.detail && <Text testID="talk-detail" style={{ color: c.muted, fontSize: 17, lineHeight: 25, textAlign: "center" }}>{turn.detail}</Text>}
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
        <Status error={ask.error ?? undo.error} />
        {ask.isError && !turn && (
          <Pressable accessibilityRole="button" onPress={() => ask.mutate({ text: "", notSure: false })} style={{ paddingVertical: 6 }}>
            <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        )}
      </StepSequence>
    </InterviewFrame>
  );
}
