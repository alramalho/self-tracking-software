import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import {
  addDays,
  addWeeks,
  differenceInWeeks,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronRight } from "lucide-react-native";
import { Copy, Heading, IconButton, s, useColors } from "@/components/ui";
import { dayKey, parseLocalDate, dateLabel } from "@/core/dates";
import { dailyRatings, metricDayKey } from "./model";
import type { MetricHeatmapProps } from "./types";

export function MetricHeatmap({
  metric,
  entries,
  eventImpacts = [],
}: MetricHeatmapProps) {
  const c = useColors();
  const list = useRef<FlatList<Date>>(null);
  const [selected, setSelected] = useState<string>();
  const ratings = useMemo(() => dailyRatings(entries), [entries]);
  const weeks = useMemo(() => {
    const earliest = [...entries].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0];
    const start = startOfWeek(
      earliest
        ? parseLocalDate(metricDayKey(earliest.createdAt))
        : subWeeks(new Date(), 2),
    );
    const count =
      Math.max(5, differenceInWeeks(addWeeks(new Date(), 1), start)) + 1;
    return Array.from({ length: count }, (_, i) => addWeeks(start, i));
  }, [entries]);
  const colors = c.dark
    ? ["#242424", "#991B1B", "#9A3412", "#A16207", "#4D7C0F", "#166534"]
    : ["#EBEDF0", "#F87171", "#FDBA74", "#FDE047", "#A3E635", "#4ADE80"];
  const impactsForDay = (key: string) =>
    eventImpacts.filter(
      (impact) =>
        key >= dayKey(impact.startedAt) && key <= dayKey(impact.endedAt),
    );
  const today = dayKey(new Date());
  const todayIndex = Math.max(
    0,
    weeks.findIndex((date) => dayKey(date) === dayKey(startOfWeek(new Date()))),
  );
  return (
    <View style={{ gap: 12 }} testID="metric-heatmap">
      {selected && (
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: c.soft,
            gap: 8,
          }}
        >
          <Heading>
            {metric.emoji} {metric.title} on {dateLabel(selected)}
          </Heading>
          <Copy>
            {ratings.has(selected)
              ? `${ratings.get(selected)!.toFixed(1)} / 5`
              : "No rating recorded for this date."}
          </Copy>
          {entries
            .filter((entry) => metricDayKey(entry.createdAt) === selected)
            .map((entry) => (
              <Copy key={entry.id}>
                {entry.description ?? (entry.skipped ? "Skipped" : "")}
              </Copy>
            ))}
          {impactsForDay(selected)
            .slice(0, 3)
            .map((impact) => (
              <View key={impact.event.id}>
                <Copy>{impact.event.title}</Copy>
                <Copy muted>
                  {format(impact.startedAt, "MMM d")} –{" "}
                  {format(impact.endedAt, "MMM d")} ·{" "}
                  {impact.delta > 0 ? "+" : ""}
                  {impact.delta.toFixed(1)} vs baseline
                </Copy>
              </View>
            ))}
        </View>
      )}
      <View style={{ flexDirection: "row" }}>
        <View style={{ gap: 6, paddingTop: 30, width: 38 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={{ height: 20, fontSize: 10, color: c.text }}>
              {day}
            </Text>
          ))}
        </View>
        <FlatList
          ref={list}
          horizontal
          data={weeks}
          initialNumToRender={30}
          windowSize={5}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(date) => dayKey(date)}
          initialScrollIndex={Math.max(0, todayIndex - 10)}
          getItemLayout={(_, index) => ({
            length: 26,
            offset: index * 26,
            index,
          })}
          renderItem={({ item: week }) => (
            <View style={{ width: 26, gap: 6 }}>
              <Text style={{ height: 24, fontSize: 10, color: c.muted }}>
                {week.getDate() <= 7 ? format(week, "MMM") : ""}
              </Text>
              {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map(
                (date) => {
                  const key = dayKey(date);
                  const value = ratings.get(key);
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`${metric.title} ${key} ${value?.toFixed(1) ?? "no rating"}`}
                      accessibilityState={{ selected: selected === key }}
                      onPress={() => setSelected(key)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        backgroundColor: colors[value ? Math.round(value) : 0],
                        borderWidth: selected === key || today === key ? 2 : 0,
                        borderColor: selected === key ? "#0066FF" : "#FF0000",
                      }}
                    >
                      {!!impactsForDay(key).length && (
                        <View
                          style={{
                            position: "absolute",
                            right: -2,
                            top: -2,
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            borderWidth: 1.5,
                            borderColor: "#3b82f6",
                          }}
                        />
                      )}
                    </Pressable>
                  );
                },
              )}
            </View>
          )}
        />
      </View>
      <View style={s.row}>
        <Copy muted>Low</Copy>
        {colors.slice(1).map((color) => (
          <View
            key={color}
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              backgroundColor: color,
            }}
          />
        ))}
        <Copy muted>High</Copy>
        {!!eventImpacts.length && <Copy muted>◦ Context</Copy>}
        <View style={{ flex: 1 }} />
        <IconButton
          label="Show today's metric"
          icon={ChevronRight}
          onPress={() => {
            setSelected(today);
            list.current?.scrollToIndex({
              index: todayIndex,
              viewPosition: 0.7,
              animated: true,
            });
          }}
        />
      </View>
    </View>
  );
}
