import { Pressable, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SettingsRowProps } from "./types";
export function SettingsRow({
  icon: Icon,
  title,
  onPress,
  selected,
  value,
  trailing,
  chevron,
  destructive,
  disabled,
  testID,
}: SettingsRowProps) {
  const c = useColors();
  const color = destructive ? "#ef4444" : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.5 : pressed ? 0.55 : 1,
      })}
    >
      {Icon && <Icon size={24} strokeWidth={1.8} color={color} />}
      <Text style={{ flex: 1, fontSize: 16, color }}>{title}</Text>
      {!!value && (
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, maxWidth: "50%", fontSize: 15, color: c.muted }}
        >
          {value}
        </Text>
      )}
      {trailing}
      {selected && <Check size={20} color={c.accent} />}
      {chevron && (
        <View style={{ marginLeft: -4 }}>
          <ChevronRight size={18} color={c.muted} />
        </View>
      )}
    </Pressable>
  );
}
