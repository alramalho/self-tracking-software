import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Flame, Sprout, Rocket, TriangleAlert } from "lucide-react-native";
import { planPace, weekAtRisk } from "@tsw/prisma/follow-through/pace";
import { useFollowThrough } from "@/features/follow-through/api";
import { router } from "expo-router";
import { differenceInCalendarDays, endOfWeek, isSameWeek, startOfDay, format } from "date-fns";
import { useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import type { Plan, ActivityEntry, Metric } from "@/core/types";
import type { CoachAttentionItem } from "@/features/messages/types";
import type { PlanPreviewProps, StepsProps } from "./types";
import { CoachItemDrawer } from "@/features/coach/inbox/CoachItemDrawer";
import { alertItem, planAlert } from "@/features/coach/model";
import { progressCircles, streakProgress } from "@/features/plans/streak-progress";
import { PlanCircleFaces } from "./PlanCircleFaces";

function Steps({ value, max, color, iconColor = color, icon: Icon, label, atRisk, lost }: StepsProps) {
  const c = useColors();
  const circles = progressCircles(value, max);
  return (
    <View
      accessibilityLabel={`${label}: ${value} of ${max}${atRisk ? ", cutting it close" : ""}${lost ? ", lost a week" : ""}`}
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
        {Array.from({ length: circles.count }, (_, i) =>
          i === value && lost ? (
            <LostDot key={i} />
          ) : i >= value && atRisk ? (
            <SpinningDashedDot key={i} />
          ) : (
            <View
              key={i}
              style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < value ? color : c.soft }}
            />
          ),
        )}
      </View>
      {circles.overflow > 0 && <Text style={{ color, fontSize: 12, fontWeight: "600" }}>+{circles.overflow}</Text>}
      <Icon size={14} color={iconColor} />
      {lost && <Text style={{ color: RED, fontSize: 12, fontWeight: "700" }}>−1</Text>}
    </View>
  );
}
/** The streak week that last week's miss took away: a red ring with a cross drawn dead centre. */
function LostDot() {
  const bar = { position: "absolute", width: 7, height: 1.5, borderRadius: 1, backgroundColor: RED } as const;
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: RED,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={[bar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[bar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}
/** A still-needed session this week: a dashed amber dot that turns slowly (stays still with Reduce Motion). */
function SpinningDashedDot() {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.timing(turn, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#f59e0b",
        transform: [{ rotate }],
      }}
    />
  );
}

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";

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

export function PlanPreview({ plan, entries, circle }: PlanPreviewProps) {
  const c = useColors();
  const coach = useCoachState(plan, entries);
  const followThrough = useFollowThrough();
  const alert = planAlert({ plan, entries, state: followThrough.data?.state });
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const weekTarget =
    typeof week?.plannedActivities === "number" ? week.plannedActivities : plan.timesPerWeek;
  const weekIsAtRisk =
    plan.outlineType === "TIMES_PER_WEEK" &&
    weekAtRisk({
      target: weekTarget,
      doneDays: count,
      // Same week boundaries as `count` (date-fns isSameWeek), today included.
      daysLeft: differenceInCalendarDays(endOfWeek(now), now) + 1,
    });
  const warning = coach.pace === "slipping" || weekIsAtRisk;
  // Last week was missed: the lost streak dot stays on the card all week (the sheet explains it).
  const missed = plan.progress?.achievement?.missedLastWeek ?? null;
  const lostStreak = !!missed && missed.streakBefore > missed.streakAfter;
  const openPlan = () =>
    router.push({ pathname: "/(tabs)/plans", params: { selectedPlan: plan.id } });
  const progress = plan.progress;
  const achievement = streakProgress(progress);
  const next = plan.sessions
    ?.filter((session) => new Date(session.date) >= startOfDay(now))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const ended =
    !!plan.finishingDate && new Date(plan.finishingDate) < startOfDay(now);
  return (
    <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        coach.pace === "slipping"
          ? `${plan.goal}, gone quiet. Show what to do`
          : weekIsAtRisk
            ? `${plan.goal}, this week is at risk. Show what to do`
            : missed
              ? `${plan.goal}, missed last week. Show what happened`
              : `Open ${plan.goal}`
      }
      accessibilityValue={{ text: `${achievement.stage}, ${achievement.streak} weeks` }}
      onPress={() => (warning || missed ? setSheetOpen(true) : openPlan())}
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
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ fontSize: 24 }}>
            {plan.activities[0]?.emoji ?? plan.emoji}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {circle && <PlanCircleFaces circle={circle} />}
            {/* Slipping gets the ring too; an at-risk week gets only the icon, next to its dashed dots. */}
            {(coach.pace === "slipping" || weekIsAtRisk) && (
              <TriangleAlert size={16} color={AMBER} />
            )}
          </View>
        </View>
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
            max={weekTarget}
            atRisk={weekIsAtRisk}
            color="#22c55e"
            iconColor="#ff9500"
            icon={Flame}
          />
          {achievement.stage === "Lifestyle" ? (
            <Steps
              label="Lifestyle"
              value={achievement.streak}
              max={achievement.target}
              lost={lostStreak}
              color="#fbbf24"
              icon={Rocket}
            />
          ) : (
            <Steps
              label="Habit"
              value={achievement.streak}
              max={achievement.target}
              lost={lostStreak}
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
    {sheetOpen && alert && (
      <CoachItemDrawer item={alertItem<Plan, CoachAttentionItem, Metric>(alert)} onClose={() => setSheetOpen(false)} />
    )}
    </>
  );
}
