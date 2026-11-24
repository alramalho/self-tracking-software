import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Mic, Square } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { errorMessage } from "@/data/api";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { previewVoiceLog } from "@/features/voice-log/service";
import { useVoiceLogRecorder } from "@/features/voice-log/useVoiceLogRecorder";
import type { VoiceFillButtonProps } from "./types";

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** "Say it": one note fills the amount, the day and what the session was about. */
export function VoiceFillButton({ activity, onFill }: VoiceFillButtonProps) {
  const c = useColors();
  const consent = useAiConsent();
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const recorder = useVoiceLogRecorder({
    onError: (error) => setProblem(errorMessage(error)),
    onRecordingReady: async (uri) => {
      setReading(true);
      try {
        const preview = await previewVoiceLog(uri, {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientRequestId: randomUUID(),
          focusActivityId: activity.id,
        });
        const found = preview.activities.find((a) => a.activityId === activity.id);
        if (!found) {
          setProblem(preview.unresolved[0]?.reason ?? `Say how many ${activity.measure}, then try again.`);
          return;
        }
        onFill({
          quantity: found.quantity,
          date: found.date,
          time: found.time,
          description: [
            found.description?.trim(),
            found.estimatedFrom ? `Estimated from ${found.estimatedFrom}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      } catch (error) {
        setProblem(errorMessage(error));
      } finally {
        setReading(false);
      }
    },
  });
  const recording = recorder.isRecording;
  async function press() {
    setProblem(undefined);
    if (recording) return void recorder.stop();
    if (!(await consent.ask())) return;
    await recorder.start();
  }
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Pressable
        testID="voice-fill"
        accessibilityRole="button"
        accessibilityLabel={recording ? "Stop and fill in" : `Say how much ${activity.title} you did`}
        disabled={reading || recorder.isWorking}
        onPress={() => void press()}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 18,
          borderRadius: 22,
          backgroundColor: recording ? "#ef444422" : c.card,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {reading ? (
          <ActivityIndicator size="small" color={c.muted} />
        ) : recording ? (
          <Square size={14} color="#ef4444" fill="#ef4444" />
        ) : (
          <Mic size={18} color={c.accent} strokeWidth={2.2} />
        )}
        <Text style={{ color: recording ? "#ef4444" : c.text, fontSize: 15, fontWeight: "500" }}>
          {reading ? "Filling it in…" : recording ? clock(recorder.durationMillis) : "Say it instead"}
        </Text>
      </Pressable>
      {!!problem && (
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>{problem}</Text>
      )}
      {consent.sheet}
    </View>
  );
}
