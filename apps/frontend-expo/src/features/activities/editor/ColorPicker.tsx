import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { activityColors } from "./colors";
import type { ColorPickerProps } from "./types";

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const c = useColors(),
    [open, setOpen] = useState(false);
  const mutedBackground = c.dark ? c.soft : "#f4f4f5";
  const gray = c.dark ? "#71717a" : "#e5e7eb";
  const options = [
    { name: "Automatic (based on plan)", hex: "" },
    ...activityColors,
  ];
  if (
    value &&
    !options.some((option) => option.hex.toLowerCase() === value.toLowerCase())
  )
    options.push({ name: "Custom color", hex: value });
  function swatches(hex: string, size: number) {
    return (
      <View style={{ flexDirection: "row", gap: size === 16 ? 4 : 8 }}>
        {["66", "aa", ""].map((alpha) => (
          <View
            key={alpha}
            style={{
              width: size,
              height: size,
              borderRadius: 3,
              backgroundColor: `${hex || gray}${alpha}`,
            }}
          />
        ))}
      </View>
    );
  }
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.inputBorder,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Activity Color"
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 48,
          padding: 12,
          backgroundColor: mutedBackground,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text
          style={{ color: c.text, fontSize: 16, fontWeight: "600", flex: 1 }}
        >
          Activity Color
        </Text>
        {!open && swatches(value, 16)}
        {open ? (
          <ChevronUp size={18} color={c.text} />
        ) : (
          <ChevronDown size={18} color={c.text} />
        )}
      </Pressable>
      {open && (
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 280 }}
          contentContainerStyle={{ padding: 12, gap: 8 }}
        >
          {options.map((option) => (
            <Pressable
              key={option.hex}
              accessibilityRole="button"
              accessibilityLabel={option.name}
              accessibilityState={{
                selected: option.hex.toLowerCase() === value.toLowerCase(),
                disabled: !!disabled,
              }}
              disabled={disabled}
              onPress={() => onChange(option.hex)}
              style={{
                minHeight: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: c.inputBorder,
                borderRadius: 12,
                backgroundColor:
                  option.hex.toLowerCase() === value.toLowerCase()
                    ? mutedBackground
                    : c.card,
              }}
            >
              {option.hex.toLowerCase() === value.toLowerCase() && (
                <Check size={20} color={c.text} />
              )}
              <Text style={{ color: c.text, fontWeight: "500", flex: 1 }}>
                {option.name}
              </Text>
              {swatches(option.hex, 24)}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
