import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { IconButton, useColors } from "@/components/ui";
import type { LoggingCalendarProps } from "./types";

export function LoggingCalendar({
  value,
  onChange,
  variant = "compact",
}: LoggingCalendarProps) {
  const c = useColors();
  const large = variant === "large";
  const [month, setMonth] = useState(() => startOfMonth(value));
  const today = startOfDay(new Date());
  const end = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  for (let day = startOfWeek(month); day <= end; day = addDays(day, 1))
    days.push(day);
  function select(day: Date) {
    const selected = new Date(day);
    selected.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(selected);
    setMonth(startOfMonth(day));
  }
  return (
    <View
      testID="logging-calendar"
      style={{
        alignSelf: "center",
        width: large ? "100%" : 280,
        maxWidth: "100%",
        padding: large ? 12 : 8,
        borderRadius: large ? 10 : 12,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={
            large
              ? {
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  backgroundColor: c.soft,
                }
              : undefined
          }
        >
          <IconButton
            label="Previous month"
            icon={ChevronLeft}
            onPress={() => setMonth(addMonths(month, -1))}
          />
        </View>
        <Text
          style={{
            fontSize: large ? 18 : 14,
            fontWeight: "500",
            color: c.text,
          }}
        >
          {format(month, "MMMM yyyy")}
        </Text>
        <View
          style={
            large
              ? {
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  backgroundColor: c.soft,
                }
              : undefined
          }
        >
          <IconButton
            label="Next month"
            icon={ChevronRight}
            disabled={isSameMonth(month, today)}
            onPress={() => setMonth(addMonths(month, 1))}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <Text
            key={day}
            style={{
              width: `${100 / 7}%`,
              textAlign: "center",
              color: c.muted,
              fontSize: large ? 16 : 12,
              paddingVertical: large ? 8 : 5,
            }}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day) => {
          const selected = isSameDay(day, value);
          const disabled = day > today;
          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={format(day, "EEEE, MMMM d, yyyy")}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => select(day)}
              style={{
                width: `${100 / 7}%`,
                height: large ? 48 : 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: large ? 42 : 32,
                  height: large ? 42 : 32,
                  borderRadius: large ? 10 : 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected
                    ? large
                      ? c.text
                      : c.accent
                    : isSameDay(day, today)
                      ? c.soft
                      : "transparent",
                }}
              >
                <Text
                  style={{
                    color: selected ? (large ? c.bg : "#fff") : c.text,
                    fontSize: large ? 16 : 14,
                    opacity: disabled || !isSameMonth(day, month) ? 0.4 : 1,
                  }}
                >
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
