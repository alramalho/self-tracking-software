import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { SessionTargetRows } from "@/features/plans/SessionTargetRows";
import { dayNumber, longDate, unitLabel, weekRange, weekday } from "@/features/onboarding/design/format";
import { dayKind, planDays } from "./model";
import type { DayTileProps, PlanDay, PlanWeeksProps } from "./types";

function DayTile({ day, emoji, selected, onPress }: DayTileProps) {
  const c = useColors();
  const kind = dayKind(day);
  const quantity = day.scheduled[0]?.quantity;
  return (
    <Pressable
      testID={`plan-day-${day.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${longDate(day.key)}, ${kind === "rest" ? "rest day" : kind}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 74,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accent : c.inputBorder,
        backgroundColor: c.card,
        opacity: day.isPast && !day.logged ? 0.55 : 1,
      }}
    >
      <Text style={{ color: day.isToday ? c.accent : c.muted, fontSize: 10, fontWeight: "600" }}>
        {weekday(day.key).toUpperCase()}
      </Text>
      <Text style={{ color: day.isToday ? c.accent : c.text, fontSize: 15, fontWeight: "700" }}>
        {dayNumber(day.key)}
      </Text>
      {day.logged && kind !== "rest" ? (
        <Text style={{ fontSize: 12, color: "#22c55e", fontWeight: "700" }}>{emoji} ✓</Text>
      ) : kind === "scheduled" ? (
        <Text style={{ fontSize: 12, color: c.text }}>
          {emoji}
          {quantity ?? ""}
        </Text>
      ) : kind === "flexible" ? (
        <Text style={{ fontSize: 12, opacity: 0.45 }}>{emoji}</Text>
      ) : null}
    </Pressable>
  );
}

// This week and next, the onboarding schedule's layout: tap a day to see what it asks for.
export function PlanWeeks({ plan, entries, own }: PlanWeeksProps) {
  const c = useColors();
  const planEntries = useMemo(
    () => entries.filter((entry) => !entry.deletedAt && plan.activities.some((a) => a.id === entry.activityId)),
    [plan, entries],
  );
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: [plan], entries: planEntries, now: new Date(), weekCount: 2 }),
    [plan, planEntries],
  );
  // Plan sessions carry the coach's title and targets; the projection keeps them.
  const weeks = planDays(projection, planEntries) as PlanDay[][];
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  // A times-per-week plan has no rest days, only days you haven't used yet.
  const flexiblePlan = plan.outlineType === "TIMES_PER_WEEK";
  const kind = dayKind(day) === "rest" && flexiblePlan ? "flexible" : dayKind(day);
  const activityOf = (id?: string) => plan.activities.find((a) => a.id === id) ?? plan.activities[0];
  const emoji = plan.activities[0]?.emoji ?? plan.emoji ?? "•";
  const session = day.scheduled[0];
  const activity = activityOf(session?.activityId ?? day.done[0]?.activityId ?? day.flexible[0]?.activityId);
  const summary = projection.summaries.find((s) => s.weekIndex === (weeks[0].some((d) => d.key === day.key) ? 0 : 1));
  const canLog = own && !!activity && !day.logged && kind !== "rest" && day.key <= projection.todayKey;
  const title =
    kind === "scheduled"
      ? `${activity?.emoji ?? ""} ${session.title ?? activity?.title ?? "Session"}`
      : kind === "rest"
        ? "Rest day"
        : `${activity?.emoji ?? ""} ${activity?.title ?? ""}`;
  const subtitle =
    kind === "scheduled"
      ? `${longDate(day.key)}${session.quantity ? ` · ${session.quantity} ${unitLabel(activity?.measure ?? "", session.quantity)}` : ""}${day.logged ? " · done" : ""}`
      : kind === "done"
        ? `${longDate(day.key)} · done`
        : kind === "flexible"
          ? `Any day works${summary ? ` · ${summary.remaining} left ${summary.weekIndex ? "next week" : "this week"}` : ""}`
          : longDate(day.key);
  return (
    <View testID="plan-weeks" style={{ gap: 14 }}>
      {weeks.map((days, index) => (
        <View key={index} style={{ gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
            {index ? "Next week" : "This week"} · {weekRange(days[0].key)}
          </Text>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {days.map((d) => (
              <DayTile
                key={d.key}
                day={d}
                emoji={emoji}
                selected={d.key === day.key}
                onPress={() => setSelectedKey(d.key)}
              />
            ))}
          </View>
        </View>
      ))}
      <View testID="plan-day-detail" style={{ gap: 12, padding: 18, borderRadius: 18, backgroundColor: c.card }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>{title.trim()}</Text>
          <Text style={{ color: c.muted, fontSize: 14 }}>{subtitle}</Text>
        </View>
        {kind === "scheduled" && !!session.targets && <SessionTargetRows targets={session.targets} />}
        {kind === "scheduled" && !!session.descriptiveGuide && (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{session.descriptiveGuide}</Text>
        )}
        {canLog && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Log ${activity!.title}`}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/add",
                params: { activityId: activity!.id, date: new Date(`${day.key}T12:00:00`).toISOString() },
              })
            }
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.accent,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>
              Log {activity!.title.toLowerCase()}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
