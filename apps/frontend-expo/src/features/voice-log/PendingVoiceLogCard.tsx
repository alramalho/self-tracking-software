import { ChevronRight, Lightbulb, Mic, Trash2 } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { VoiceLogDraft } from "./types";

export interface PendingVoiceLogCardProps {
  draft: VoiceLogDraft;
  onReview: () => void;
  onDiscard: () => void;
}

export function PendingVoiceLogCard({
  draft,
  onReview,
  onDiscard,
}: PendingVoiceLogCardProps) {
  const c = useColors();
  const voiceAccent = `${c.accent}99`;
  const hasPlanSuggestion = !!draft.preview.planSuggestions?.length;
  const pill = (pressed: boolean) => ({
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: c.soft,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    opacity: pressed ? 0.6 : 1,
  });
  return (
    <Pressable
      testID="pending-voice-note-card"
      accessibilityLabel="Voice note waiting"
      onPress={onReview}
      style={{
        gap: 14,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Mic size={28} color={voiceAccent} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
            Voice note waiting
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {hasPlanSuggestion
              ? "Includes a plan idea to review."
              : "Nothing is saved until you confirm."}
          </Text>
        </View>
        {hasPlanSuggestion && <Lightbulb size={18} color={c.muted} />}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard voice note"
          onPress={onDiscard}
          style={({ pressed }) => pill(pressed)}
        >
          <Trash2 size={15} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 14, fontWeight: "600" }}>
            Discard
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review voice note"
          onPress={onReview}
          style={({ pressed }) => pill(pressed)}
        >
          <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
            Review
          </Text>
          <ChevronRight size={16} color={c.text} />
        </Pressable>
      </View>
    </Pressable>
  );
}
