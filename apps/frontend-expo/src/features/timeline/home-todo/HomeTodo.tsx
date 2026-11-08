import { View } from "react-native";
import { router } from "expo-router";
import {
  isDailyCheckinDue,
  plansNeedingDecision,
} from "@tsw/prisma/home-todo";
import { GroupedRows, Heading, Panel } from "@/components/ui";
import type { GroupedRow } from "@/components/types";
import { WeekCalendar } from "@/features/plans/WeekCalendar";
import { CoachNote } from "./CoachNote";
import type { HomeTodoProps } from "./types";

/** Top of the homepage: what is left to do this week and next, at a glance. */
export function HomeTodo({
  plans,
  entries,
  metrics,
  metricEntries,
  user,
  onCheckin,
}: HomeTodoProps) {
  const now = new Date();
  const scheduled = plans.filter(
    (plan) =>
      !plan.isPaused &&
      (!plan.finishingDate || new Date(plan.finishingDate) > now),
  );
  const openPlan = (planId: string) =>
    router.push({ pathname: "/(tabs)/plans", params: { selectedPlan: planId } });
  const rows: GroupedRow[] = plansNeedingDecision(plans, now).map((plan) => ({
    id: plan.planId,
    icon: plan.emoji || "📋",
    title: plan.goal,
    value: plan.reason === "ended" ? "Ended" : "No sessions left",
    attention: true,
    onPress: () => openPlan(plan.planId),
  }));
  if (
    user?.planType !== "FREE" &&
    isDailyCheckinDue(metrics, metricEntries, now)
  )
    rows.push({
      id: "daily-checkin",
      icon: "📊",
      title: "Daily check-in",
      value: "Not logged today",
      onPress: onCheckin,
    });
  return (
    <View testID="home-todo" style={{ gap: 12 }}>
      <CoachNote user={user} />
      {!!scheduled.length && (
        <Panel style={{ borderRadius: 24, padding: 16 }}>
          <Heading>Next two weeks</Heading>
          <WeekCalendar
            plans={scheduled}
            entries={entries}
            selectionDisplay="card"
          />
        </Panel>
      )}
      {!!rows.length && <GroupedRows testID="home-todo-rows" rows={rows} />}
    </View>
  );
}
