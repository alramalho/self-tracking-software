import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Flame, Sprout, Rocket, TriangleAlert } from "lucide-react-native";
import { planPace, weekAtRisk } from "@tsw/prisma/follow-through/pace";
import { useFollowThrough } from "@/features/follow-through/api";
import { router } from "expo-router";
import { differenceInCalendarDays, endOfWeek, isSameWeek, startOfDay, format } from "date-fns";
import { Copy, useColors } from "@/components/ui";
import { PreviewButton, PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import { dayKey } from "@/core/dates";
import type { Plan, ActivityEntry } from "@/core/types";
import type { PlanPreviewProps, StepsProps, WarningSheetProps } from "./types";
import { progressCircles, streakProgress } from "@/features/plans/streak-progress";

function Steps({ value, max, color, iconColor = color, icon: Icon, label, atRisk }: StepsProps) {
  const c = useColors();
  const circles = progressCircles(value, max);
  return (
    <View
      accessibilityLabel={`${label}: ${value} of ${max}${atRisk ? ", cutting it close" : ""}`}
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
            style={
              i >= value && atRisk
                ? { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: AMBER }
                : { width: 14, height: 14, borderRadius: 7, backgroundColor: i < value ? color : c.soft }
            }
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
            : `Open ${plan.goal}`
      }
      accessibilityValue={{ text: `${achievement.stage}, ${achievement.streak} weeks` }}
      onPress={() => (warning ? setSheetOpen(true) : openPlan())}
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
      {/* Slipping gets the ring too; an at-risk week gets only the icon, next to its dashed dots. */}
      {(coach.pace === "slipping" || weekIsAtRisk) && (
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
    {warning && (
      <WarningSheet
        visible={sheetOpen}
        plan={plan}
        entries={entries}
        slipping={coach.pace === "slipping"}
        nudge={coach.nudge}
        needed={weekTarget - count}
        daysLeft={differenceInCalendarDays(endOfWeek(now), now) + 1}
        onOpenPlan={() => {
          setSheetOpen(false);
          openPlan();
        }}
        onClose={() => setSheetOpen(false)}
      />
    )}
    </>
  );
}

/** Explains a warning card and offers the one action that fixes it, plus the plan itself. */
function WarningSheet({
  visible,
  plan,
  entries,
  slipping,
  nudge,
  needed,
  daysLeft,
  onOpenPlan,
  onClose,
}: WarningSheetProps) {
  const activity = plan.activities[0];
  const logs = entries
    .filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId))
    .map((e) => new Date(e.datetime));
  const last = logs.reduce((latest, d) => (d > latest ? d : latest), new Date(plan.createdAt));
  const quietDays = differenceInCalendarDays(new Date(), last);
  const logIt = () => {
    onClose();
    router.push({ pathname: "/(tabs)/add", params: activity ? { activityId: activity.id } : {} });
  };
  const openMessage = () => {
    onClose();
    router.push({
      pathname: "/chat/[id]",
      params: { id: nudge!.chatId!, planId: plan.id, messageId: nudge!.messageId!, type: "COACH" },
    });
  };
  const hasMessage = !!(nudge?.chatId && nudge.messageId);
  const c = useColors();
  const title = `${activity?.emoji ?? plan.emoji ?? ""} ${plan.goal} ${slipping ? "has gone quiet" : "is at risk this week"}`.trim();
  return (
    // The app's native bottom sheet: sized to content, drag down or tap outside to close.
    <PreviewSheet visible={visible} title={title} onClose={onClose}>
      <View style={{ gap: 6, paddingRight: 36 }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{title}</Text>
        <Copy muted>
          {slipping
            ? `Nothing logged for ${quietDays} ${quietDays === 1 ? "day" : "days"}.${hasMessage ? " Your coach has a message ready." : ""}`
            : `${needed} ${needed === 1 ? "session" : "sessions"} left and ${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go.`}
        </Copy>
      </View>
      {slipping && hasMessage ? (
        <PreviewButton label="Open coach message" onPress={openMessage} />
      ) : (
        <PreviewButton label={`Log ${activity?.title.toLowerCase() ?? "a session"}`} onPress={logIt} />
      )}
      <PreviewButton secondary label="Open plan" onPress={onOpenPlan} />
    </PreviewSheet>
  );
}
