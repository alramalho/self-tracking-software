import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Flame, Sprout, Rocket, TriangleAlert } from "lucide-react-native";
import { planPace } from "@tsw/prisma/follow-through/pace";
import { useFollowThrough } from "@/features/follow-through/api";
import { router } from "expo-router";
import { isSameWeek, startOfDay, format } from "date-fns";
import { useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import type { Plan, ActivityEntry } from "@/core/types";
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
const GREEN = "#22c55e";
const AMBER = "#f59e0b";

/**
 * How a coached plan is going (same rule the coach uses), and the coach's waiting nudge if any.
 * Tracking-only plans have no state: the coach stays out of them.
 */
function useCoachState(plan: Plan, entries: ActivityEntry[]) {
  const state = useFollowThrough().data?.state;
  const role = state?.supports[plan.id]?.coaching?.role;
  if (!role || role === "tracking") return { pace: null, nudge: undefined };
  const nudge = state?.monitoring?.requests.find(
    (r) => r.kind === "nudge" && r.planIds.includes(plan.id) && !r.resolvedAt && !r.closedAt,
  );
  const pace = planPace({
    timesPerWeek: plan.timesPerWeek,
    startedAt: new Date(plan.createdAt),
    now: new Date(),
    logDates: entries
      .filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId))
      .map((e) => new Date(e.datetime)),
  });
  return { pace: nudge ? "slipping" : pace, nudge };
}

/** A ring drawn over the card's border: steady green when on track, gently pulsing amber when slipping. */
function StateRing({ color, pulse }: { color: string; pulse: boolean }) {
  const opacity = useRef(new Animated.Value(pulse ? 0.35 : 0.8)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, opacity]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -1,
        left: -1,
        right: -1,
        bottom: -1,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: color,
        opacity,
      }}
    />
  );
}

export function PlanPreview({ plan, entries }: PlanPreviewProps) {
  const c = useColors();
  const coach = useCoachState(plan, entries);
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
      accessibilityLabel={
        coach.pace === "slipping"
          ? `${plan.goal}, needs attention. ${coach.nudge ? "Open your coach's message" : "Open plan"}`
          : `Open ${plan.goal}`
      }
      accessibilityValue={{ text: `${achievement.stage}, ${achievement.streak} weeks` }}
      onPress={() =>
        // A waiting nudge opens straight into the coach's already-written message.
        coach.nudge?.chatId && coach.nudge.messageId
          ? router.push({
              pathname: "/chat/[id]",
              params: {
                id: coach.nudge.chatId,
                planId: plan.id,
                messageId: coach.nudge.messageId,
                type: "COACH",
              },
            })
          : router.push({
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
      {coach.pace === "on_track" && <StateRing color={GREEN} pulse={false} />}
      {coach.pace === "slipping" && <StateRing color={AMBER} pulse />}
      {coach.pace === "slipping" && (
        <View style={{ position: "absolute", top: 14, right: 14 }}>
          <TriangleAlert size={16} color={AMBER} />
        </View>
      )}
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
