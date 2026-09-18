import { ChevronRight, Lightbulb, Mic } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { VoiceLogDraft } from "./types";

export interface PendingVoiceLogCardProps {
  draft: VoiceLogDraft;
  onReview: () => void;
  onDismiss: () => void;
}

export function PendingVoiceLogCard({
  draft,
  onReview,
  onDismiss,
}: PendingVoiceLogCardProps) {
  const c = useColors();
  const voiceAccent = `${c.accent}99`;
  const hasPlanSuggestion = !!draft.preview.planSuggestions?.length;
  return (
    <View
      testID="pending-voice-note-card"
      style={{
        gap: 12,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Mic size={32} color={voiceAccent} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: c.text,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Voice note waiting
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {hasPlanSuggestion
              ? "Your note includes a possible plan idea to review."
              : "Your extracted logs are waiting for your confirmation."}
          </Text>
        </View>
        {hasPlanSuggestion && (
          <Lightbulb size={18} color={c.muted} />
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review voice note"
          onPress={onReview}
          style={({ pressed }) => ({
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: c.muted,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            Review note
          </Text>
          <ChevronRight size={16} color={c.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss voice note"
          onPress={onDismiss}
          style={({ pressed }) => ({
            minHeight: 40,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: c.muted, fontSize: 13 }}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
