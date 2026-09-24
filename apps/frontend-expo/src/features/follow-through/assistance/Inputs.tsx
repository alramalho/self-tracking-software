import { Platform, Pressable, ScrollView, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
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
const wheelRowHeight = 40;

function TimeWheel({ label, selected, total, onSelect }: { label: string; selected: number; total: number; onSelect: (value: number) => void }) {
  const c = useColors();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: selected * wheelRowHeight, animated: false });
  }, [selected]);
  return (
    <View style={{ width: 86, height: wheelRowHeight * 3, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: wheelRowHeight, left: 0, right: 0, height: wheelRowHeight, borderRadius: 12, backgroundColor: c.selectedBg }} />
      <ScrollView
        ref={scroll}
        accessibilityLabel={label}
        showsVerticalScrollIndicator={false}
        snapToInterval={wheelRowHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => onSelect(Math.max(0, Math.min(total - 1, Math.round(event.nativeEvent.contentOffset.y / wheelRowHeight))))}
        contentContainerStyle={{ paddingVertical: wheelRowHeight }}
      >
        {Array.from({ length: total }, (_, number) => (
          <Pressable
            key={number}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${String(number).padStart(2, "0")}`}
            accessibilityState={{ selected: number === selected }}
            onPress={() => onSelect(number)}
            style={{ height: wheelRowHeight, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: number === selected ? c.text : c.muted, fontSize: number === selected ? 22 : 17, fontWeight: number === selected ? "600" : "400", fontVariant: ["tabular-nums"] }}>
              {String(number).padStart(2, "0")}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [h, m] = value.split(":").map(Number);
  if (Platform.OS === "web")
    return (
      <View style={{ gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Review time ${value}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
          <Text style={{ color: c.text, fontSize: 15 }}>Time</Text>
          <Text style={{ color: c.accent, fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"], backgroundColor: c.selectedBg, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 9 }}>{value}</Text>
        </Pressable>
        {expanded && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 18, backgroundColor: c.card, paddingVertical: 8 }}>
          <TimeWheel label="Hour" selected={h || 0} total={24} onSelect={(hour) => onChange(`${String(hour).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`)} />
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "600" }}>:</Text>
          <TimeWheel label="Minute" selected={m || 0} total={60} onSelect={(minute) => onChange(`${String(h || 0).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)} />
        </View>}
      </View>
    );
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: c.text, fontSize: 15 }}>Time</Text>
      <DateTimePicker
        accessibilityLabel="Time"
        value={date}
        mode="time"
        display={Platform.OS === "ios" ? "compact" : "default"}
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
