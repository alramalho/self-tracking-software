import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Heading, Panel, useColors } from "@/components/ui";
import { useHealthWorkouts } from "./queries";
import { formatPace, paceChange, workoutTrends } from "./workout-model";
import type { PlanWorkoutTrendsProps, WorkoutTrendCardProps } from "./workout-types";

const BAR_HEIGHT = 64;

const amount = (value: number, unit: "km" | "min") =>
  unit === "km" && value > 0 ? value.toFixed(value >= 100 ? 0 : 1) : String(Math.round(value));

/** Apple Fitness-style summary of one activity: this week's total over eight weekly bars. */
export function WorkoutTrendCard({ trend }: WorkoutTrendCardProps) {
  const c = useColors();
  const max = Math.max(...trend.weeks.map((week) => week.value), 0.001);
  const current = trend.weeks[trend.weeks.length - 1];
  const change = trend.pace && paceChange(trend.pace);
  const firstWeek = new Date(`${trend.weeks[0].start}T12:00:00`).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
  return (
    <Panel testID={`workout-trend-${trend.key}`} style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
          {trend.emoji ? `${trend.emoji} ` : ""}
          {trend.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{trend.count} in 8 weeks</Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>This week</Text>
        <Text style={{ color: c.text, fontSize: 34, fontWeight: "700", letterSpacing: -0.5 }}>
          {amount(current.value, trend.unit)}
          <Text style={{ color: c.muted, fontSize: 17, fontWeight: "600" }}> {trend.unit}</Text>
        </Text>
      </View>
      <View>
        <View
          accessibilityLabel={`Weekly ${trend.unit === "km" ? "distance" : "minutes"}, last 8 weeks`}
          style={{ height: BAR_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 6 }}
        >
          {trend.weeks.map((week, index) => (
            <View
              key={week.start}
              style={{
                flex: 1,
                height: Math.max(3, (week.value / max) * BAR_HEIGHT),
                borderRadius: 4,
                backgroundColor: index === trend.weeks.length - 1 ? c.accent : c.soft,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{firstWeek}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>This week</Text>
        </View>
      </View>
      {trend.pace && (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
            {formatPace(trend.pace.recent)} /km
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: "400" }}> recent pace</Text>
          </Text>
          {change && <Text style={{ color: c.muted, fontSize: 13 }}>{change}</Text>}
        </View>
      )}
    </Panel>
  );
}

/**
 * The plan page's Workouts section: watch workouts linked to this plan's activities. Shows only when
 * there is a trend to show (Apple Health or Garmin connected, two or more in the last eight weeks).
 */
export function PlanWorkoutTrends({ plan, entries }: PlanWorkoutTrendsProps) {
  const workouts = useHealthWorkouts();
  const activityIds = new Set((plan.activities ?? []).map((activity) => activity.id));
  const planEntries = new Set(
    entries.filter((entry) => entry.activityId && activityIds.has(entry.activityId)).map((entry) => entry.id),
  );
  const trends = workoutTrends(
    (workouts.data?.items ?? []).filter(
      (item) => item.resolved?.activityEntryId && planEntries.has(item.resolved.activityEntryId),
    ),
  );
  if (!trends.length) return null;
  return (
    <View testID="plan-workout-trends" style={{ gap: 10 }}>
      <Heading>Workouts</Heading>
      {trends.map((trend) => (
        <WorkoutTrendCard key={trend.key} trend={trend} />
      ))}
    </View>
  );
}
