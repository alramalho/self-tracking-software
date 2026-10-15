import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type { DuplicateHintProps } from "./types";

/** "You already have 🥾 Hike  Use ›" — shown under the title while it is typed. */
export function DuplicateHint({
  activity,
  label,
  action,
  disabled,
  onPress,
}: DuplicateHintProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${activity.title}. ${action}`}
      testID="activity-duplicate-hint"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.inputBorder,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20 }}>{activity.emoji}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: c.muted }}>
        {label} <Text style={{ color: c.text, fontWeight: "600" }}>{activity.title}</Text>
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Text style={{ color: c.accent, fontWeight: "600" }}>{action}</Text>
        <ChevronRight size={16} color={c.accent} />
      </View>
    </Pressable>
  );
}
