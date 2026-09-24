import { Pressable, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { WeeklyFrequencyPickerProps } from "./types";

export function WeeklyFrequencyPicker({
  value,
  onChange,
  disabled = false,
}: WeeklyFrequencyPickerProps) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 26, gap: 8 }}>
      <View
        style={{
          width: 264,
          maxWidth: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          testID="onboarding-frequency-decrease"
          accessibilityRole="button"
          accessibilityLabel="Decrease sessions per week"
          accessibilityState={{ disabled: disabled || value <= 1 }}
          disabled={disabled || value <= 1}
          onPress={() => onChange(Math.max(1, value - 1))}
          style={({ pressed }) => ({
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: c.inputBorder,
            backgroundColor: c.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled || value <= 1 ? 0.35 : pressed ? 0.6 : 1,
          })}
        >
          <Minus size={22} strokeWidth={1.8} color={c.text} />
        </Pressable>
        <Text
          testID="onboarding-weekly-frequency-value"
          accessibilityLabel={`${value} sessions per week`}
          style={{
            minWidth: 84,
            color: c.text,
            fontSize: 58,
            lineHeight: 68,
            fontWeight: "700",
            textAlign: "center",
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
        <Pressable
          testID="onboarding-frequency-increase"
          accessibilityRole="button"
          accessibilityLabel="Increase sessions per week"
          accessibilityState={{ disabled: disabled || value >= 7 }}
          disabled={disabled || value >= 7}
          onPress={() => onChange(Math.min(7, value + 1))}
          style={({ pressed }) => ({
            width: 54,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: c.inputBorder,
            backgroundColor: c.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled || value >= 7 ? 0.35 : pressed ? 0.6 : 1,
          })}
        >
          <Plus size={22} strokeWidth={1.8} color={c.text} />
        </Pressable>
      </View>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
        sessions per week
      </Text>
    </View>
  );
}
