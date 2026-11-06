import { Pressable, View } from "react-native";
import { Square, X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { CheckInPulse } from "@/components/follow-up/Presentation";
import { clockDuration } from "./format";
import { maxVoiceNoteMillis } from "./useVoiceNote";
import type { VoiceNoteRecordingProps } from "./types";

// Replaces the add tile while a voice note records: time, stop, discard.
export function VoiceNoteRecording({ durationMillis, onStop, onDiscard }: VoiceNoteRecordingProps) {
  const c = useColors();
  return (
    <View
      testID="voice-note-recording"
      style={{
        minHeight: 104,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: c.accent,
        backgroundColor: c.soft,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discard voice note"
        onPress={onDiscard}
        hitSlop={8}
      >
        <X size={20} color={c.muted} />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CheckInPulse />
          <Text style={{ fontSize: 22, fontWeight: "600", color: c.text, fontVariant: ["tabular-nums"] }}>
            {clockDuration(durationMillis)}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: c.muted }}>
          up to {clockDuration(maxVoiceNoteMillis)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        onPress={onStop}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: c.accent,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Square size={18} color="white" fill="white" />
      </Pressable>
    </View>
  );
}
