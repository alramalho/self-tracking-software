import { ActivityIndicator, Pressable } from "react-native";
import { Mic, Square } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { useDictation } from "./useDictation";
import type { DictationButtonProps } from "./types";

function durationLabel(durationMillis: number) {
  const seconds = Math.floor(durationMillis / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DictationButton(props: DictationButtonProps) {
  const colors = useColors();
  const dictation = useDictation(props);
  const aiConsent = useAiConsent();
  const unavailable = props.disabled || dictation.isWorking;
  const subject = props.label ?? "answer";
  const label = dictation.isRecording
    ? `Stop dictation, ${durationLabel(dictation.durationMillis)}`
    : dictation.isWorking
      ? `Transcribing ${subject}`
      : `Dictate ${subject}`;
  const accessibilityLabel =
    dictation.isRecording || dictation.isWorking
      ? label
      : (props.accessibilityLabel ?? label);

  async function press() {
    // Recordings are transcribed by an AI provider, so ask first.
    if (!dictation.isRecording && !(await aiConsent.ask())) return;
    await dictation.toggle();
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        hitSlop={8}
        onPress={() => void press()}
        style={({ pressed }) => ({
          height: 44,
          minWidth: dictation.isRecording ? 82 : 44,
          paddingHorizontal: dictation.isRecording ? 12 : 0,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: dictation.isRecording ? "#ef4444" : colors.inputBorder,
          backgroundColor: dictation.isRecording ? "#ef44441a" : colors.fadedBg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          opacity: pressed || unavailable ? 0.6 : 1,
        })}
      >
        {dictation.isWorking ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : dictation.isRecording ? (
          <>
            <Square size={14} fill="#ef4444" color="#ef4444" />
            <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>
              {durationLabel(dictation.durationMillis)}
            </Text>
          </>
        ) : (
          <Mic size={21} color={colors.text} />
        )}
      </Pressable>
      {aiConsent.sheet}
    </>
  );
}
