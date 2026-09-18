import { useMemo, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";
import { addDays, addWeeks, format, startOfWeek, subDays } from "date-fns";
import { Text } from "@/components/typography/Text";
import { Copy, s, useColors } from "@/components/ui";
import { dateLabel, dayKey } from "@/core/dates";
import { estimatedSleepQuality } from "@/features/metrics/model";
import type { SleepGridProps } from "./types";

const CELL = 20;
const GAP = 5;

const qualityColors = (dark: boolean) =>
  dark
    ? ["#242424", "#991B1B", "#B91C1C", "#A16207", "#4D7C0F", "#166534"]
    : ["#EBEDF0", "#FCA5A5", "#F87171", "#FACC15", "#86EFAC", "#4ADE80"];

const colorForQuality = (quality: number | null, dark: boolean) => {
  if (quality == null) return qualityColors(dark)[0];
  return qualityColors(dark)[
    Math.min(5, Math.max(1, Math.floor(quality / 20) + 1))
  ];
};

export function SleepGrid({
  scores,
  days,
  selectedDate,
  onSelect,
}: SleepGridProps) {
  const c = useColors();
  const list = useRef<FlatList<Date>>(null);
  const today = new Date();
  const todayKey = dayKey(today);
  const scoreByDate = useMemo(
    () => new Map(scores.map((score) => [score.date, score])),
    [scores],
  );
  const weeks = useMemo(() => {
    const first = startOfWeek(subDays(today, days - 1));
    const last = startOfWeek(today);
    const values: Date[] = [];
    for (let date = first; date <= last; date = addWeeks(date, 1))
      values.push(date);
    return values;
  }, [days, todayKey]);
  const todayIndex = Math.max(
    0,
    weeks.findIndex((week) => dayKey(week) === dayKey(startOfWeek(today))),
  );

  return (
    <View testID="sleep-grid" style={{ gap: 12 }}>
      <View style={s.row}>
        <Copy muted>
          {format(subDays(today, days - 1), "MMM d")} —{" "}
          {format(today, "MMM d, yyyy")}
        </Copy>
        <View style={{ flex: 1 }} />
        <Copy muted>Bad</Copy>
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: colorForQuality(20, c.dark),
          }}
        />
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: colorForQuality(90, c.dark),
          }}
        />
        <Copy muted>Good</Copy>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ gap: GAP, paddingTop: 23, paddingRight: 8 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text
              key={`${day}-${index}`}
              style={{
                width: 12,
                height: CELL,
                fontSize: 10,
                lineHeight: CELL,
                color: c.muted,
                textAlign: "center",
              }}
            >
              {index % 2 === 0 ? day : ""}
            </Text>
          ))}
        </View>
        <FlatList
          ref={list}
          horizontal
          data={weeks}
          keyExtractor={(week) => dayKey(week)}
          initialScrollIndex={Math.max(0, todayIndex - 4)}
          getItemLayout={(_, index) => ({
            length: CELL + GAP,
            offset: (CELL + GAP) * index,
            index,
          })}
          initialNumToRender={28}
          windowSize={5}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: week }) => (
            <View style={{ width: CELL + GAP, gap: GAP }}>
              <Text style={{ height: 18, fontSize: 10, color: c.muted }}>
                {week.getDate() <= 7 ? format(week, "MMM") : ""}
              </Text>
              {Array.from({ length: 7 }, (_, index) =>
                addDays(week, index),
              ).map((date) => {
                const key = dayKey(date);
                const score = scoreByDate.get(key);
                const quality = score ? estimatedSleepQuality(score) : null;
                const selected = selectedDate === key;
                const todayCell = todayKey === key;
                const inRange =
                  key >= dayKey(subDays(today, days - 1)) && key <= todayKey;
                return (
                  <Pressable
                    key={key}
                    disabled={!inRange}
                    accessibilityRole="button"
                    accessibilityLabel={`${dateLabel(date)}, ${quality == null ? "no sleep score" : `${quality} out of 100`}`}
                    accessibilityState={{ selected, disabled: !inRange }}
                    onPress={() => onSelect(key)}
                    style={({ pressed }) => ({
                      width: CELL,
                      height: CELL,
                      borderRadius: 4,
                      backgroundColor: inRange
                        ? colorForQuality(quality, c.dark)
                        : "transparent",
                      borderWidth: selected || todayCell ? 2 : 0,
                      borderColor: selected ? c.selectedBorder : c.accent,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  />
                );
              })}
            </View>
          )}
        />
      </View>
      <Copy muted>
        Color shows sleep quality. Empty days mean no sleep data was recorded;
        they are not counted as bad nights.
      </Copy>
    </View>
  );
}
