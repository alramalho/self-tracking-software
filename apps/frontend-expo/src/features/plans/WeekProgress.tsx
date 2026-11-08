import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/typography/Text";
import {
  endOfWeek,
  format,
  isFuture,
  isSameWeek,
  startOfWeek,
} from "date-fns";
import { router } from "expo-router";
import { Copy, Panel, Sheet, s, useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import { WeekCalendar } from "./WeekCalendar";
import type { AllWeeksSheetProps, WeekProgressProps } from "./types";

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

// Current and upcoming weeks, titled the way the PWA's "All Weeks" sheet is.
function AllWeeksSheet({ visible, onClose, ...props }: AllWeeksSheetProps) {
  const c = useColors();
  const weeks = props.plan.progress?.weeks ?? [];
  const upcoming = weeks.filter(
    (week) =>
      isSameWeek(new Date(week.startDate), new Date()) ||
      isFuture(startOfWeek(new Date(week.startDate))),
  );
  return (
    <Sheet visible={visible} title="All weeks" onClose={onClose}>
      {(upcoming.length
        ? upcoming.map((week) => new Date(week.startDate))
        : [startOfWeek(new Date())]
      ).map((start) => {
        const index = weeks.findIndex((week) =>
          isSameWeek(new Date(week.startDate), start),
        );
        return (
          <Panel key={dayKey(start)} style={{ borderRadius: 16 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
                {isSameWeek(start, new Date()) || index === -1
                  ? "Current week"
                  : `Week ${index + 1} / ${weeks.length}`}
              </Text>
              <Text style={{ fontSize: 14, color: c.muted }}>
                {format(start, "d")}-{format(endOfWeek(start), "d MMM")}
              </Text>
            </View>
            <WeekProgress {...props} date={start} own={false} />
          </Panel>
        );
      })}
    </Sheet>
  );
}

function SeeAllWeeks({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See all weeks"
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 12, color: c.muted }}>See all weeks</Text>
    </Pressable>
  );
}

export function CurrentWeek(props: WeekProgressProps) {
  const c = useColors();
  const [allWeeks, setAllWeeks] = useState(false);
  const date = startOfWeek(new Date());
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
        <SeeAllWeeks onPress={() => setAllWeeks(true)} />
      </View>
      <WeekProgress {...props} />
      <AllWeeksSheet
        {...props}
        visible={allWeeks}
        onClose={() => setAllWeeks(false)}
      />
    </Panel>
  );
}

export function ComingUp(props: WeekProgressProps) {
  const c = useColors();
  const [allWeeks, setAllWeeks] = useState(false);
  const { plan, entries, own } = props;
  return (
    <Panel testID="plan-coming-up-island" style={{ padding: 16, borderRadius: 16 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
          Coming up
        </Text>
        <SeeAllWeeks onPress={() => setAllWeeks(true)} />
      </View>
      <WeekCalendar
        plans={[plan]}
        entries={entries}
        onLog={
          own
            ? (activityId, date) =>
                router.push({
                  pathname: "/(tabs)/add",
                  params: { activityId, date: date.toISOString() },
                })
            : undefined
        }
      />
      <AllWeeksSheet
        {...props}
        visible={allWeeks}
        onClose={() => setAllWeeks(false)}
      />
    </Panel>
  );
}
