import { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Copy, useColors } from "./ui";
import { dateLabel, localDateTime, parseLocalDate } from "@/core/dates";
import type { DateFieldProps } from "./types";
export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  includeTime = true,
}: DateFieldProps) {
  const [mode, setMode] = useState<"date" | "time">();
  const c = useColors();
  const parsed = parseLocalDate(value);
  return (
    <View style={{ gap: 8 }}>
      <Copy muted>{label}</Copy>
      <Button secondary onPress={() => setMode("date")}>
        {dateLabel(parsed)}
      </Button>
      {includeTime && (
        <Button secondary onPress={() => setMode("time")}>
          {parsed.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Button>
      )}
      {mode && (
        <DateTimePicker
          themeVariant={c.dark ? "dark" : "light"}
          textColor={c.text}
          accentColor={c.accent}
          value={parsed}
          mode={mode}
          maximumDate={maximumDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            if (Platform.OS !== "ios") setMode(undefined);
            if (event.type === "set" && date) onChange(localDateTime(date));
          }}
        />
      )}
      {mode && Platform.OS === "ios" && (
        <Button secondary onPress={() => setMode(undefined)}>
          Done
        </Button>
      )}
    </View>
  );
}
