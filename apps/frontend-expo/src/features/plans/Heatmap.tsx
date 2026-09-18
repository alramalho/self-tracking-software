import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react-native";
import { memo, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { format } from "date-fns";
import { dayKey, dateLabel } from "@/core/dates";
import { Button, Copy, Heading, s, useColors } from "@/components/ui";
import { activityColor, buildHeatmap } from "./grid-model";
import type { GridWeek, HeatmapProps } from "./grid-types";
const CELL = 20;
export const Heatmap = memo(function Heatmap(props: HeatmapProps) {
  const c = useColors();
  const gap = props.compact ? 2 : 6;
  const columnWidth = CELL + gap;
  const model = useMemo(
    () => buildHeatmap(props),
    [
      props.activities,
      props.entries,
      props.plan,
      props.startDate,
      props.endDate,
      props.premium,
    ],
  );
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [selected, setSelected] = useState<string>();
  const list = useRef<FlatList<GridWeek>>(null);
  const todayIndex = Math.max(
    0,
    model.weeks.findIndex((w) => w.days.some((d) => d.today)),
  );
  const current = model.weeks
    .flatMap((w) => w.days)
    .find((d) => d.key === selected);
  const [width, setWidth] = useState(300);
  return (
    <View testID={props.testID ?? "activity-heatmap"} style={{ gap: 12 }}>
      {!props.compact && (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Copy muted>
              {format(model.startDate, "MMM yyyy")} —{" "}
              {format(model.endDate, "MMM yyyy")}
            </Copy>
          </View>
          <Button
            secondary
            onPress={() => {
              setSelected(dayKey(new Date()));
              list.current?.scrollToIndex({
                index: todayIndex,
                viewPosition: 0.7,
                animated: true,
              });
            }}
          >
            Today
          </Button>
        </View>
      )}
      <View
        style={[
          s.row,
          { alignItems: "flex-start", gap: props.compact ? 8 : 12 },
        ]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <View
          style={{
            gap,
            paddingTop: 18 + gap,
            paddingRight: props.compact ? 2 : 6,
          }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text
              key={day}
              style={{
                height: CELL,
                fontSize: 10,
                lineHeight: CELL,
                color: c.text,
              }}
            >
              {day}
            </Text>
          ))}
        </View>
        <FlatList
          ref={list}
          horizontal
          style={{ flex: 1 }}
          data={model.weeks}
          keyExtractor={(w) => w.key}
          initialScrollIndex={Math.max(
            0,
            todayIndex - Math.floor(width / columnWidth) + 3,
          )}
          getItemLayout={(_, i) => ({
            length: columnWidth,
            offset: columnWidth * i,
            index: i,
          })}
          initialNumToRender={28}
          maxToRenderPerBatch={20}
          windowSize={5}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: week }) => (
            <View style={{ width: columnWidth, gap }}>
              <Text style={{ height: 18, fontSize: 10, color: c.muted }}>
                {week.date.getDate() <= 7 ? format(week.date, "MMM") : ""}
              </Text>
              {week.days.map((day) => (
                <Pressable
                  key={day.key}
                  testID={`grid-day-${day.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateLabel(day.date)}, ${day.entries.length} activities${day.paused ? ", paused" : ""}${day.today ? ", today" : ""}`}
                  accessibilityState={{ selected: day.key === selected }}
                  onPress={() => setSelected(day.key)}
                  style={{
                    height: CELL,
                    width: CELL,
                    borderRadius: 4,
                    overflow: "hidden",
                    backgroundColor: day.paused
                      ? c.dark
                        ? "#422006"
                        : "#fef3c7"
                      : c.dark
                        ? "#242424"
                        : "#ebedf0",
                    position: "relative",
                  }}
                >
                  {day.segments.slice(0, 4).map((segment, i) => {
                    const count = Math.min(day.segments.length, 4);
                    const half = (CELL - 1) / 2;
                    return (
                      <View
                        key={segment.entryId}
                        style={{
                          position: "absolute",
                          left: count === 1 || i % 2 === 0 ? 0 : half + 1,
                          top: count <= 2 || i < 2 ? 0 : half + 1,
                          width:
                            count === 1 || (count === 3 && i === 2)
                              ? CELL
                              : half,
                          height: count <= 2 ? CELL : half,
                          backgroundColor: activityColor(
                            props.activities.findIndex(
                              (a) => a.id === segment.activity.id,
                            ),
                            segment.intensity,
                            segment.activity.colorHex,
                            c.dark,
                          ),
                        }}
                      />
                    );
                  })}
                  {(day.paused || day.today || day.key === selected) && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 4,
                        borderWidth:
                          day.today || day.key === selected ? 2 : 1.5,
                        borderColor:
                          day.key === selected
                            ? "#0066FF"
                            : day.today
                              ? "#FF0000"
                              : c.dark
                                ? "#FBBF24"
                                : "#F59E0B",
                        borderStyle:
                          day.paused && !day.today && day.key !== selected
                            ? "dashed"
                            : "solid",
                      }}
                    />
                  )}
                </Pressable>
              ))}
              <Text
                accessibilityLabel={
                  week.completed ? "Week completed" : "Week incomplete"
                }
                style={{
                  width: CELL,
                  height: 24,
                  fontSize: 18,
                  textAlign: "center",
                }}
              >
                {week.completed ? "🔥" : ""}
              </Text>
            </View>
          )}
        />
        {props.compact && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll to current week"
            onPress={() =>
              list.current?.scrollToIndex({
                index: todayIndex,
                viewPosition: 0.7,
                animated: true,
              })
            }
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={22} color={c.text} />
          </Pressable>
        )}
      </View>
      {model.historyLimited && (
        <Copy muted>
          Showing the last 180 days. Full history is available with Plus.
        </Copy>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: legendExpanded }}
        onPress={() => setLegendExpanded(!legendExpanded)}
        style={[s.row, { minHeight: 44 }]}
      >
        {legendExpanded ? (
          <ChevronUp color={c.text} size={25} />
        ) : (
          <ChevronDown color={c.text} size={25} />
        )}
        <Heading>Legend</Heading>
      </Pressable>
      {legendExpanded && (
        <View style={{ gap: 12 }}>
          <View style={s.row}>
            <View
              style={{
                width: 16,
                height: 16,
                borderWidth: 2,
                borderColor: "#FF0000",
              }}
            />
            <View
              style={{
                width: 16,
                height: 16,
                borderWidth: 2,
                borderColor: "#0066FF",
              }}
            />
            <Copy>Today / Selected</Copy>
          </View>
          {!!props.plan?.pauseHistory?.length && <Copy>▧ Paused</Copy>}
          {props.activities.map((activity, index) => (
            <Pressable
              key={activity.id}
              onPress={() => props.onActivityPress?.(activity)}
              accessibilityRole={props.onActivityPress ? "button" : undefined}
              style={[s.row, { minHeight: 44 }]}
            >
              <View style={{ flexDirection: "row" }}>
                {[0, 1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: activityColor(
                        index,
                        level,
                        activity.colorHex,
                        c.dark,
                      ),
                    }}
                  />
                ))}
              </View>
              <Copy>
                {activity.emoji} {activity.title}
              </Copy>
            </Pressable>
          ))}
        </View>
      )}
      {current && (
        <View
          testID="grid-day-details"
          style={{
            gap: 10,
            padding: 14,
            backgroundColor: c.bg,
            borderRadius: 14,
          }}
        >
          <Heading>{dateLabel(current.date)}</Heading>
          {current.paused && <Copy>Plan paused on this day</Copy>}
          {current.entries.length === 0 ? (
            <Copy muted>No activities recorded for this date.</Copy>
          ) : (
            current.entries.map((entry) => {
              const activity = props.activities.find(
                (a) => a.id === entry.activityId,
              );
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => props.onEntryPress?.(entry)}
                  accessibilityRole={props.onEntryPress ? "button" : undefined}
                >
                  <Copy>
                    {activity?.emoji} {activity?.title} · {entry.quantity}{" "}
                    {activity?.measure}
                    {entry.difficulty ? ` · ${entry.difficulty}` : ""}
                  </Copy>
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
});
