import { Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SettingsRowProps } from "./types";
export function SettingsRow({
  icon: Icon,
  title,
  onPress,
  selected,
}: SettingsRowProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Icon size={28} strokeWidth={1.8} color={c.text} />
      <Text style={{ flex: 1, fontSize: 16, color: c.text }}>{title}</Text>
      {selected && <Check size={20} color={c.accent} />}
    </Pressable>
  );
}
