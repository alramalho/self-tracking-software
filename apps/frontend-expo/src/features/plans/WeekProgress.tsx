import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { endOfWeek, format, isSameWeek, startOfWeek } from "date-fns";
import { router } from "expo-router";
import {
  Button,
  Copy,
  Heading,
  Panel,
  Sheet,
  s,
  useColors,
} from "@/components/ui";
import { dayKey } from "@/core/dates";
import type { WeekProgressProps } from "./types";

export function WeekProgress({
  plan,
  entries,
  date = new Date(),
  own = false,
}: WeekProgressProps) {
  const c = useColors();
  const week = plan.progress?.weeks?.find((week) =>
    isSameWeek(new Date(week.startDate), date),
  );
  const count = new Set(
    entries
      .filter(
        (entry) =>
          !entry.deletedAt &&
          plan.activities.some(
            (activity) => activity.id === entry.activityId,
          ) &&
          isSameWeek(new Date(entry.datetime), date),
      )
      .map((entry) => dayKey(entry.datetime)),
  ).size;
  const target =
    typeof week?.plannedActivities === "number"
      ? week.plannedActivities
      : Array.isArray(week?.plannedActivities)
        ? week.plannedActivities.length
        : plan.outlineType === "TIMES_PER_WEEK"
          ? plan.timesPerWeek
          : plan.sessions.filter((session) =>
              isSameWeek(new Date(session.date), date),
            ).length;
  const completed = target > 0 && count >= target;
  return (
    <View testID="plan-week-progress" style={{ gap: 12 }}>
      {completed && (
        <Text
          style={{
            alignSelf: "flex-start",
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 4,
            fontSize: 12,
            color: "#22c55e",
            backgroundColor: "#22c55e22",
          }}
        >
          Week completed
        </Text>
      )}
      {target > 0 ? (
        <>
          <View
            accessibilityLabel={`Activities: ${count} of ${target}`}
            style={{ flexDirection: "row", gap: 4 }}
          >
            {Array.from({ length: Math.min(target, 100) }, (_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 3,
                  backgroundColor: index < count ? "#22c55e" : c.soft,
                }}
              />
            ))}
          </View>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            {plan.emoji} ACTIVITIES:{" "}
            <Text style={{ fontWeight: "600" }}>
              {count}/{target}
            </Text>
          </Text>
          {!completed && plan.outlineType === "TIMES_PER_WEEK" && (
            <>
              <Copy muted>Coming up, any of:</Copy>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {plan.activities.map((activity) => (
                  <Pressable
                    key={activity.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${activity.title} from plan`}
                    disabled={!own}
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/add",
                        params: { activityId: activity.id },
                      })
                    }
                    style={{
                      minWidth: 64,
                      padding: 8,
                      gap: 8,
                      alignItems: "center",
                      backgroundColor: c.soft,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{activity.emoji}</Text>
                    <Text style={{ color: c.text, fontSize: 12 }}>
                      {activity.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </>
      ) : (
        <Copy muted>📭 No activities scheduled for this week</Copy>
      )}
    </View>
  );
}

export function CurrentWeek(props: WeekProgressProps) {
  const c = useColors();
  const [allWeeks, setAllWeeks] = useState(false);
  const date = startOfWeek(new Date());
  const weeks = [...(props.plan.progress?.weeks ?? [])].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
  return (
    <Panel
      testID="plan-current-week-island"
      style={{ padding: 16, borderRadius: 16 }}
    >
      <View
        style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
            Current week
          </Text>
          <Text style={{ fontSize: 14, color: c.muted }}>
            {format(date, "d")}-{format(endOfWeek(date), "d MMM")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all weeks"
          onPress={() => setAllWeeks(true)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 12, color: c.muted }}>See all weeks</Text>
        </Pressable>
      </View>
      <WeekProgress {...props} />
      <Sheet
        visible={allWeeks}
        title="All weeks"
        onClose={() => setAllWeeks(false)}
      >
        {(weeks.length
          ? weeks.map((week) => new Date(week.startDate))
          : [date]
        ).map((start) => (
          <Panel key={dayKey(start)}>
            <Heading>
              {format(start, "d MMM")} –{" "}
              {format(endOfWeek(start), "d MMM yyyy")}
            </Heading>
            <WeekProgress {...props} date={start} own={false} />
          </Panel>
        ))}
      </Sheet>
    </Panel>
  );
}
