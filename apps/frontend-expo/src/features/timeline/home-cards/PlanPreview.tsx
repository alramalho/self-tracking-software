import { Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Flame, Sprout, Rocket } from "lucide-react-native";
import { router } from "expo-router";
import { isSameWeek, startOfDay, format } from "date-fns";
import { useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import type { PlanPreviewProps, StepsProps } from "./types";
import { progressCircles, streakProgress } from "@/features/plans/streak-progress";

function Steps({ value, max, color, iconColor = color, icon: Icon, label }: StepsProps) {
  const c = useColors();
  const circles = progressCircles(value, max);
  return (
    <View
      accessibilityLabel={`${label}: ${value} of ${max}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
          flexShrink: 1,
        }}
      >
        {Array.from({ length: circles.count }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < value ? color : c.soft,
            }}
          />
        ))}
      </View>
      {circles.overflow > 0 && <Text style={{ color, fontSize: 12, fontWeight: "600" }}>+{circles.overflow}</Text>}
      <Icon size={14} color={iconColor} />
    </View>
  );
}
export function PlanPreview({ plan, entries }: PlanPreviewProps) {
  const c = useColors();
  const now = new Date();
  const week = plan.progress?.weeks?.find((week) =>
    isSameWeek(new Date(week.startDate), now),
  );
  const count = new Set(
    entries
      .filter(
        (entry) =>
          !entry.deletedAt &&
          plan.activities.some(
            (activity) => activity.id === entry.activityId,
          ) &&
          isSameWeek(new Date(entry.datetime), now),
      )
      .map((entry) => dayKey(entry.datetime)),
  ).size;
  const progress = plan.progress;
  const achievement = streakProgress(progress);
  const next = plan.sessions
    ?.filter((session) => new Date(session.date) >= startOfDay(now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const ended =
    !!plan.finishingDate && new Date(plan.finishingDate) < startOfDay(now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${plan.goal}`}
      accessibilityValue={{ text: `${achievement.stage}, ${achievement.streak} weeks` }}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/plans",
          params: { selectedPlan: plan.id },
        })
      }
      style={{
        aspectRatio: 1,
        borderRadius: 24,
        backgroundColor: c.card,
        padding: 16,
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: ended ? "#f59e0b66" : c.border,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 24 }}>
          {plan.activities[0]?.emoji ?? plan.emoji}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontSize: 14, fontWeight: "500", color: c.text }}
        >
          {plan.goal}
        </Text>
        {ended && (
          <Text style={{ fontSize: 11, color: "#f59e0b" }}>Past end date</Text>
        )}
      </View>
      {plan.outlineType === "TIMES_PER_WEEK" ? (
        <View style={{ gap: 10 }}>
          <Steps
            label="This week"
            value={count}
            max={
              typeof week?.plannedActivities === "number"
                ? week.plannedActivities
                : plan.timesPerWeek
            }
            color="#22c55e"
            iconColor="#ff9500"
            icon={Flame}
          />
          {achievement.stage === "Lifestyle" ? (
            <Steps
              label="Lifestyle"
              value={achievement.streak}
              max={achievement.target}
              color="#fbbf24"
              icon={Rocket}
            />
          ) : (
            <Steps
              label="Habit"
              value={achievement.streak}
              max={achievement.target}
              color="#a3e635"
              icon={Sprout}
            />
          )}
        </View>
      ) : (
        <View
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: c.soft,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 11, color: c.muted }}>
            {next ? "Next session" : "Needs planning"}
          </Text>
          <Text style={{ fontSize: 12, color: c.text }}>
            {next
              ? `${plan.activities.find((activity) => activity.id === next.activityId)?.title} · ${format(new Date(next.date), "EEE, MMM d")}`
              : ended
                ? "Ended. Archive it or renew it with your coach."
                : "No upcoming sessions. The coach can plan the next week."}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
