import { Pressable, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { NumberPickerProps } from "./types";

// Shared by age and weekly frequency so both feel like the same native control.
export function NumberPicker({ value, onChange, disabled = false, min, max, unit, decreaseLabel, increaseLabel, valueLabel, testID, valueTestID }: NumberPickerProps) {
  const c = useColors();
  const button = (decrease: boolean) => {
    const blocked = disabled || (decrease ? value <= min : value >= max);
    const Icon = decrease ? Minus : Plus;
    return (
      <Pressable
        testID={`${testID}-${decrease ? "decrease" : "increase"}`}
        accessibilityRole="button"
        accessibilityLabel={decrease ? decreaseLabel : increaseLabel}
        accessibilityState={{ disabled: blocked }}
        disabled={blocked}
        onPress={() => onChange(Math.max(min, Math.min(max, value + (decrease ? -1 : 1))))}
        style={({ pressed }) => ({
          width: 54, height: 54, borderRadius: 27, borderWidth: 1,
          borderColor: c.inputBorder, backgroundColor: c.card,
          alignItems: "center", justifyContent: "center",
          opacity: blocked ? 0.35 : pressed ? 0.6 : 1,
        })}
      >
        <Icon size={22} strokeWidth={1.8} color={c.text} />
      </Pressable>
    );
  };
  return (
    <View style={{ alignItems: "center", paddingVertical: 26, gap: 8 }}>
      <View style={{ width: 264, maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {button(true)}
        <Text testID={valueTestID ?? `${testID}-value`} accessibilityLabel={valueLabel} style={{ minWidth: 84, color: c.text, fontSize: 58, lineHeight: 68, fontWeight: "700", textAlign: "center", fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
        {button(false)}
      </View>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{unit}</Text>
    </View>
  );
}
