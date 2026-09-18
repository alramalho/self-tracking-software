import { Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Field, useColors } from "@/components/ui";
import type { ChoiceProps, DaysInputProps, TimeInputProps } from "./types";
export const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function Choice({
  icon,
  title,
  detail,
  selected,
  disabled,
  onPress,
}: ChoiceProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: selected ? c.selectedBg : c.card,
        borderWidth: 1,
        borderColor: selected ? c.accent : "transparent",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
          {title}
        </Text>
        {detail && (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
            {detail}
          </Text>
        )}
      </View>
      {selected ? (
        <Check size={20} color={c.accent} />
      ) : (
        <ChevronRight size={18} color={c.muted} />
      )}
    </Pressable>
  );
}
export function TimeInput({ value, onChange }: TimeInputProps) {
  const c = useColors();
  if (Platform.OS === "web")
    return (
      <Field
        label="Time"
        value={value}
        onChangeText={onChange}
        placeholder="18:00"
      />
    );
  const date = new Date();
  const [h, m] = value.split(":").map(Number);
  date.setHours(h || 0, m || 0, 0, 0);
  return (
    <View style={{ alignItems: "center" }}>
      <DateTimePicker
        accessibilityLabel="Time"
        value={date}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        themeVariant={c.dark ? "dark" : "light"}
        textColor={c.text}
        accentColor={c.accent}
        onChange={(event, next) => {
          if (event.type === "set" && next)
            onChange(
              `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`,
            );
        }}
      />
    </View>
  );
}
export function DaysInput({
  value,
  onChange,
  single,
  maximum = 7,
}: DaysInputProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {days.map((day, index) => {
        const selected = value.includes(index),
          disabled = !single && !selected && value.length >= maximum;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={day}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() =>
              onChange(
                single
                  ? [index]
                  : selected
                    ? value.filter((d) => d !== index)
                    : [...value, index].sort(),
              )
            }
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 14,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: selected ? c.selectedBg : c.card,
              borderWidth: 1,
              borderColor: selected ? c.accent : "transparent",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>
              {day}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export const validTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
