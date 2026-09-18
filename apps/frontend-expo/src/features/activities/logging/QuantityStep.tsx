import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Minus, Pencil, Plus } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, IconButton, useColors } from "@/components/ui";
import { localDateTime, parseLocalDate } from "@/core/dates";
import { LoggingCalendar } from "./LoggingCalendar";
import type { QuantityStepProps } from "./types";

export function QuantityStep({
  activity,
  date,
  quantity,
  onDateChange,
  onQuantityChange,
  onNext,
}: QuantityStepProps) {
  const c = useColors();
  const [editTime, setEditTime] = useState(false);
  const parsed = parseLocalDate(date);
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 36, lineHeight: 46 }}>{activity.emoji}</Text>
        <Text style={{ color: c.muted, fontSize: 12, fontStyle: "italic" }}>
          📍 {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </Text>
      </View>
      <LoggingCalendar
        value={parsed}
        onChange={(value) => onDateChange(localDateTime(value))}
      />
      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit time"
          accessibilityState={{ expanded: editTime }}
          onPress={() => setEditTime(!editTime)}
          style={{
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minHeight: 36,
          }}
        >
          <Text style={{ fontSize: 14, color: c.muted }}>at {time}</Text>
          <Pencil size={14} color={c.muted} />
        </Pressable>
        {editTime && (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
              Select Time
            </Text>
            {Platform.OS === "web" ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {(["Hours", "Minutes"] as const).map((label, index) => (
                  <TextInput
                    key={label}
                    accessibilityLabel={label}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={String(
                      index ? parsed.getMinutes() : parsed.getHours(),
                    ).padStart(2, "0")}
                    onChangeText={(text) => {
                      const value = Number(text);
                      if (!/^\d{0,2}$/.test(text) || value > (index ? 59 : 23))
                        return;
                      const next = new Date(parsed);
                      if (index) next.setMinutes(value);
                      else next.setHours(value);
                      onDateChange(localDateTime(next));
                    }}
                    style={{
                      color: c.text,
                      backgroundColor: c.card,
                      textAlign: "center",
                      width: 60,
                      height: 44,
                      borderRadius: 12,
                    }}
                  />
                ))}
              </View>
            ) : (
              <DateTimePicker
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                value={parsed}
                themeVariant={c.dark ? "dark" : "light"}
                textColor={c.text}
                accentColor={c.accent}
                is24Hour
                onChange={(event, value) => {
                  if (Platform.OS !== "ios") setEditTime(false);
                  if (event.type === "set" && value) {
                    const next = new Date(parsed);
                    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
                    onDateChange(localDateTime(next));
                  }
                }}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done editing time"
              onPress={() => setEditTime(false)}
              style={{ padding: 12 }}
            >
              <Text style={{ color: c.accent, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
          how many{" "}
          <Text style={{ fontStyle: "italic" }}>{activity.measure}</Text>?
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              backgroundColor: c.card,
              borderColor: c.inputBorder,
              borderWidth: 1,
              borderRadius: 12,
            }}
          >
            <IconButton
              label="Decrease quantity"
              icon={Minus}
              disabled={Number(quantity) <= 0}
              onPress={() =>
                onQuantityChange(String(Math.max(0, Number(quantity) - 1)))
              }
            />
          </View>
          <TextInput
            testID="field-Quantity"
            accessibilityLabel="Quantity"
            inputAccessoryViewID={
              Platform.OS === "ios" ? "logging-input-done" : undefined
            }
            selectTextOnFocus
            keyboardType="number-pad"
            value={quantity}
            onChangeText={onQuantityChange}
            style={{
              color: c.text,
              width: 84,
              height: 44,
              fontFamily: "Inter-Bold",
              fontSize: 24,
              textAlign: "center",
            }}
          />
          <View
            style={{
              backgroundColor: c.card,
              borderColor: c.inputBorder,
              borderWidth: 1,
              borderRadius: 12,
            }}
          >
            <IconButton
              label="Increase quantity"
              icon={Plus}
              onPress={() => onQuantityChange(String(Number(quantity) + 1))}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[10, 30, 45, 60, 90].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Set quantity to ${value}`}
              onPress={() => onQuantityChange(String(value))}
              style={({ pressed }) => ({
                minWidth: 44,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.card,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Button disabled={!Number(quantity)} onPress={onNext}>
        Log Activity
      </Button>
    </>
  );
}
