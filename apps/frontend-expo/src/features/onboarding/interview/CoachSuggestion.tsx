import { View } from "react-native";
import { CircleHelp } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { CoachSuggestionProps } from "./types";

export function CoachSuggestion({ message }: CoachSuggestionProps) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.soft,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        padding: 16,
        borderRadius: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CircleHelp size={18} color={colors.accent} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
          Make this answer more concrete
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
        {message} Answer the question below with one specific detail.
      </Text>
    </View>
  );
}
