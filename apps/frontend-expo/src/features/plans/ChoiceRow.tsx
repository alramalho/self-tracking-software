import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type { PlanEditorChoiceProps } from "./types";

export function ChoiceRow({
  label,
  description,
  icon: Icon,
  selected,
  onPress,
}: PlanEditorChoiceProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? c.selectedBorder : c.border,
        backgroundColor: selected ? c.selectedBg : c.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {Icon ? (
        <Icon
          size={23}
          color={selected ? c.accent : c.muted}
          strokeWidth={1.8}
        />
      ) : null}
      <View style={{ flex: 1, gap: description ? 4 : 0 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {label}
        </Text>
        {description ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={20} color={c.accent} strokeWidth={2.3} /> : null}
    </Pressable>
  );
}
