import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { dayNumber, longDate, unitLabel, weekRange, weekday } from "@/features/onboarding/design/format";
import { useFollowThrough } from "@/features/follow-through/api";
import { visibleSessions } from "@/features/follow-through/model";
import { CoachNote } from "./CoachNote";
import type { HomeDayDetailProps, HomeDayTileProps, HomeItemRowProps, HomeTodoProps } from "./types";

const GREEN = "#22c55e";
/** A day tile has room for two emojis; the rest show as "+n". */
const TILE_EMOJIS = 2;

function DayTile({ day, selected, onPress }: HomeDayTileProps) {
  const c = useColors();
  const shown = day.items.slice(0, TILE_EMOJIS);
  const more = day.items.length - shown.length;
  const allDone = day.items.length > 0 && day.items.every((item) => item.kind === "done");
  return (
    <Pressable
      testID={`home-day-${day.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${longDate(day.key)}, ${day.items.length ? `${day.items.length} planned` : "nothing planned"}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 84,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingVertical: 8,
        gap: 3,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accent : c.inputBorder,
        backgroundColor: c.card,
        opacity: day.isPast && !allDone ? 0.55 : 1,
      }}
    >
      <Text style={{ color: day.isToday ? c.accent : c.muted, fontSize: 10, fontWeight: "600" }}>
        {weekday(day.key).toUpperCase()}
      </Text>
      <Text style={{ color: day.isToday ? c.accent : c.text, fontSize: 15, fontWeight: "700" }}>
        {dayNumber(day.key)}
      </Text>
      {shown.map((item) => (
        <Text
          key={item.id}
          style={{
            fontSize: 13,
            opacity: item.kind === "flexible" ? 0.45 : 1,
            color: item.kind === "done" ? GREEN : c.text,
            fontWeight: "700",
          }}
        >
          {item.emoji}
          {item.kind === "done" ? "✓" : ""}
        </Text>
      ))}
      {more > 0 && <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600" }}>+{more}</Text>}
    </Pressable>
  );
}

function ItemRow({ item, canLog, logDate }: HomeItemRowProps) {
  const c = useColors();
  const amount = item.quantity ? ` · ${item.quantity} ${unitLabel(item.measure ?? "", item.quantity)}` : "";
  const fact =
    item.kind === "done"
      ? "Done"
      : item.kind === "flexible"
        ? `Any day works${item.remaining ? ` · ${item.remaining} left this week` : ""}`
        : `${item.time ? `${item.time} · ` : ""}${item.planGoal}`;
  const openSession = () => router.push(`/session/${encodeURIComponent(item.sessionId!)}` as never);
  const openPlan = () => router.push({ pathname: "/(tabs)/plans", params: { selectedPlan: item.planId } });
  const log = () =>
    router.push({ pathname: "/(tabs)/add", params: { activityId: item.activityId, date: logDate.toISOString() } });
  const loggable = canLog && item.kind !== "done";
  return (
    <Pressable
      testID={`home-item-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${amount}. ${fact}`}
      onPress={item.sessionId && item.kind !== "done" ? openSession : loggable ? log : openPlan}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ width: 32, textAlign: "center", fontSize: 22 }}>{item.emoji}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
          {item.title}
          {amount}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
          {fact}
        </Text>
      </View>
      {item.kind === "done" ? (
        <Check size={20} color={GREEN} strokeWidth={3} />
      ) : loggable ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: c.accent }}>
          <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>Log</Text>
        </View>
      ) : (
        <ChevronRight size={18} color={c.muted} />
      )}
    </Pressable>
  );
}

function DayDetail({ day, todayKey }: HomeDayDetailProps) {
  const c = useColors();
  const canLog = day.key <= todayKey;
  // Logging a past day keeps its date; today logs at the current time.
  const logDate = day.key === todayKey ? new Date() : new Date(`${day.key}T12:00:00`);
  return (
    <View testID="home-day-detail" style={{ gap: 4, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, backgroundColor: c.soft }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: "700", paddingVertical: 4 }}>
        {day.isToday ? "Today" : longDate(day.key)}
      </Text>
      {day.items.length ? (
        day.items.map((item) => <ItemRow key={item.id} item={item} canLog={canLog} logDate={logDate} />)
      ) : (
        <Text style={{ color: c.muted, fontSize: 14, paddingBottom: 4 }}>Nothing planned. A free day.</Text>
      )}
    </View>
  );
}

/** Top of the homepage: the coach's note when it matters, then what's on this week and next. */
export function HomeTodo({ plans, entries }: HomeTodoProps) {
  const c = useColors();
  const visible = useMemo(() => {
    const now = new Date();
    return plans.filter(
      (plan) => !plan.isPaused && (!plan.finishingDate || new Date(plan.finishingDate) >= now),
    );
  }, [plans]);
  const logs = useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);
  const state = useFollowThrough().data?.state;
  const practice = useMemo(() => visibleSessions({ state, plans: visible }), [state, visible]);
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: visible, entries: logs, now: new Date(), weekCount: 2 }),
    [visible, logs],
  );
  const weeks = useMemo(
    () => homeDays({ projection, plans: visible, entries: logs, practice }),
    [projection, visible, logs, practice],
  );
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  return (
    <View testID="home-todo" style={{ gap: 12 }}>
      <CoachNote />
      {!!visible.length && (
        <View style={{ gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.card }}>
          {weeks.map((days, index) => (
            <View key={index} style={{ gap: 8 }}>
              <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                {index ? "Next week" : "This week"} · {weekRange(days[0].key)}
              </Text>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {days.map((d) => (
                  <DayTile key={d.key} day={d} selected={d.key === day.key} onPress={() => setSelectedKey(d.key)} />
                ))}
              </View>
            </View>
          ))}
          <DayDetail day={day} todayKey={projection.todayKey} />
        </View>
      )}
    </View>
  );
}
