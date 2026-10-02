import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, IconButton, Status, s, useColors } from "@/components/ui";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { LanguagesDrawer } from "./LanguagesDrawer";
import { sendTranscriptionFeedback } from "./service";
import type {
  Transcription,
  TranscriptionFeedbackProps,
  TranscriptionFeedbackReason,
  WhatWentWrongProps,
} from "./types";

const reasons: { reason: TranscriptionFeedbackReason; label: string }[] = [
  { reason: "WRONG_LANGUAGE", label: "Wrong language" },
  { reason: "WRONG_WORDS", label: "Wrong words" },
  { reason: "OTHER", label: "Something else" },
];

// A screen with a dictation button shows `banner` under its text field and passes
// `ask` to the button's onTranscription.
export function useTranscriptionFeedback() {
  const count = useRef(0);
  const [asked, setAsked] = useState<{ key: number; transcription: Transcription }>();
  return {
    ask: (transcription: Transcription) =>
      setAsked({ key: ++count.current, transcription }),
    banner: asked && (
      <TranscriptionFeedback
        key={asked.key}
        transcription={asked.transcription}
        onDone={() => setAsked(undefined)}
      />
    ),
  };
}

// The little banner after every dictation: thumbs up, or thumbs down → why →
// (for a wrong language) the languages the person speaks.
export function TranscriptionFeedback({
  transcription,
  onDone,
}: TranscriptionFeedbackProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const [step, setStep] = useState<"ask" | "why" | "languages" | "thanks">("ask");
  const heard = { language: transcription.language, model: transcription.model };
  const send = useMutation({ mutationFn: sendTranscriptionFeedback });
  const done = useRef(onDone);
  done.current = onDone;
  // Unanswered, the banner leaves on its own; after an answer it thanks and leaves.
  useEffect(() => {
    if (step !== "ask" && step !== "thanks") return;
    const timer = setTimeout(
      () => done.current(),
      step === "ask" ? 15000 : 2000,
    );
    return () => clearTimeout(timer);
  }, [step]);
  return (
    <>
      <Animated.View
        testID="transcription-feedback"
        entering={reduced ? undefined : FadeIn.duration(180)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 14,
          paddingRight: 4,
          borderRadius: 14,
          backgroundColor: c.soft + "88",
        }}
      >
        <Text style={{ flex: 1, color: c.muted, fontSize: 14 }}>
          {step === "thanks" ? "Thanks, that helps." : "Did we get that right?"}
        </Text>
        {step !== "thanks" && (
          <>
            <IconButton
              label="Transcription is right"
              icon={ThumbsUp}
              onPress={() => {
                send.mutate({ helpful: true, ...heard });
                setStep("thanks");
              }}
            />
            <IconButton
              label="Transcription is wrong"
              icon={ThumbsDown}
              onPress={() => setStep("why")}
            />
          </>
        )}
      </Animated.View>
      {step === "why" && (
        <WhatWentWrong
          busy={send.isPending}
          error={send.error}
          onClose={() => setStep("ask")}
          onSend={(reason, comment) =>
            send.mutate(
              {
                helpful: false,
                reason,
                comment,
                transcript: transcription.text,
                ...heard,
              },
              {
                onSuccess: () =>
                  setStep(reason === "WRONG_LANGUAGE" ? "languages" : "thanks"),
              },
            )
          }
        />
      )}
      {step === "languages" && (
        <LanguagesDrawer onClose={() => setStep("thanks")} />
      )}
    </>
  );
}

function WhatWentWrong({ busy, error, onSend, onClose }: WhatWentWrongProps) {
  const c = useColors();
  const [reason, setReason] = useState<TranscriptionFeedbackReason>();
  const [comment, setComment] = useState("");
  return (
    <LoggingDrawer
      testID="transcription-feedback-drawer"
      dismissLabel="Dismiss transcription feedback"
      title="What went wrong?"
      keyboardToolbar
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: c.card }}>
        {reasons.map((option, index) => (
          <Pressable
            key={option.reason}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: reason === option.reason }}
            onPress={() => setReason(option.reason)}
            style={({ pressed }) => ({
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              borderTopWidth: index ? 1 : 0,
              borderColor: c.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>
              {option.label}
            </Text>
            {reason === option.reason && <Check size={20} color={c.accent} />}
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 7 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>
          What did you say?
        </Text>
        <TextInput
          testID="transcription-feedback-comment"
          accessibilityLabel="What did you say?"
          value={comment}
          onChangeText={setComment}
          editable={!busy}
          multiline
          maxLength={2000}
          placeholder="Optional"
          placeholderTextColor={c.muted}
          inputAccessoryViewID="logging-input-done"
          style={[
            s.input,
            {
              minHeight: 84,
              textAlignVertical: "top",
              color: c.text,
              borderColor: c.inputBorder,
              backgroundColor: c.card,
            },
          ]}
        />
      </View>
      <Status error={error} />
      <Button
        disabled={!reason && !comment.trim()}
        busy={busy}
        onPress={() => onSend(reason, comment.trim() || undefined)}
      >
        Send
      </Button>
    </LoggingDrawer>
  );
}
