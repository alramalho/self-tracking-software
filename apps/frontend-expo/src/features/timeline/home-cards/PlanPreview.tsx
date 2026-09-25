import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Flame, Sprout, Rocket, TriangleAlert } from "lucide-react-native";
import { planPace, weekAtRisk } from "@tsw/prisma/follow-through/pace";
import { useFollowThrough } from "@/features/follow-through/api";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import { router } from "expo-router";
import { differenceInCalendarDays, endOfWeek, isSameWeek, startOfDay, format, subWeeks } from "date-fns";
import { Copy, useColors } from "@/components/ui";
import { PreviewButton, PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import { dayKey } from "@/core/dates";
import type { Plan, ActivityEntry } from "@/core/types";
import type { PlanPreviewProps, StepsProps, WarningSheetProps } from "./types";
import { progressCircles, streakProgress } from "@/features/plans/streak-progress";

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
  // Last week was missed: the lost streak dot stays on the card all week (the sheet explains it).
  const missed = plan.progress?.achievement?.missedLastWeek ?? null;
  const lastWeek = plan.progress?.weeks?.find((w) =>
    isSameWeek(new Date(w.startDate), subWeeks(now, 1)),
  );
  const lastWeekTally = lastWeek
    ? {
        done: new Set((lastWeek.completedActivities ?? []).map((e) => dayKey(e.datetime))).size,
        target:
          typeof lastWeek.plannedActivities === "number"
            ? lastWeek.plannedActivities
            : (lastWeek.plannedActivities?.length ?? 0),
      }
    : null;
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
    {(warning || missed) && (
      <WarningSheet
        visible={sheetOpen}
        plan={plan}
        entries={entries}
        slipping={coach.pace === "slipping"}
        atRisk={weekIsAtRisk}
        missed={missed}
        lastWeek={lastWeekTally}
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
  atRisk,
  missed,
  lastWeek,
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
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  // Only a missed last week, nothing to rescue yet this week: the sheet is the reckoning.
  const onlyMissed = !slipping && !atRisk && !!missed;
  const status = slipping ? "has gone quiet" : atRisk ? "is at risk this week" : "missed last week";
  const title = `${activity?.emoji ?? plan.emoji ?? ""} ${plan.goal} ${status}`.trim();
  const lostStreak = !!missed && missed.streakBefore > missed.streakAfter;
  // The coach's one line: framed as the coach stepping in, not the app warning you.
  const line = slipping
    ? hasMessage
      ? "I wrote you a short note about it."
      : "One session is all it takes to get it moving again."
    : atRisk
      ? missed
        ? "Last week got away from you. Let's not let this one go too, you've got this."
        : needed === daysLeft
          ? "Every remaining day counts now. One today keeps the week alive."
          : "Still doable. Getting one in today keeps it comfortable."
      : missed && missed.inARow > 1
        ? `That's ${missed.inARow} weeks in a row now, and each one costs a week of streak. One good week turns it around.`
        : lostStreak
          ? "Last week slipped by and cost you a week of streak. It happens. A fresh week just started, so let's make this one count."
          : "Last week slipped by. It happens. Fresh week, fresh start: let's make this one count.";
  const stats: [string, string][] = slipping
    ? [[`${quietDays}`, quietDays === 1 ? "day without a log" : "days without a log"]]
    : atRisk
      ? [
          [`${needed}`, needed === 1 ? "session left" : "sessions left"],
          [`${daysLeft}`, daysLeft === 1 ? "day to go" : "days to go"],
        ]
      : [
          ...(lastWeek && lastWeek.target > 0
            ? [[`${lastWeek.done}/${lastWeek.target}`, "done last week"] as [string, string]]
            : []),
          // Coached, scheduled plans are judged by their sessions; the streak is for weekly habits.
          ...(lostStreak && plan.outlineType === "TIMES_PER_WEEK"
            ? [[`${missed!.streakBefore} → ${missed!.streakAfter}`, "streak after last week"] as [string, string]]
            : missed && missed.inARow > 1
              ? [[`${missed.inARow}`, "weeks missed in a row"] as [string, string]]
              : []),
        ];
  const tone = onlyMissed ? RED : AMBER;
  return (
    // The app's native bottom sheet: sized to content, drag down or tap outside to close.
    <PreviewSheet visible={visible} title={title} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 36 }}>
        <Image source={{ uri: coach.avatar }} style={{ width: 40, height: 40 }} />
        <View>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{coach.name}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>AI Coach</Text>
        </View>
      </View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{title}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {stats.map(([number, label]) => (
          <View
            key={label}
            style={{ flex: 1, backgroundColor: c.soft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 }}
          >
            <Text style={{ color: tone, fontSize: 30, fontWeight: "800", lineHeight: 34 }}>{number}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
          </View>
        ))}
      </View>
      {missed && !onlyMissed && (
        <Text style={{ color: RED, fontSize: 13, fontWeight: "600" }}>
          💔 Missed last week
          {lostStreak && plan.outlineType === "TIMES_PER_WEEK"
            ? ` · streak ${missed.streakBefore} → ${missed.streakAfter}`
            : ""}
        </Text>
      )}
      <Copy>{line}</Copy>
      {slipping && hasMessage ? (
        <PreviewButton label="Open coach message" onPress={openMessage} />
      ) : (
        <PreviewButton label={`Log ${activity?.title.toLowerCase() ?? "a session"}`} onPress={logIt} />
      )}
      <PreviewButton secondary label="Open plan" onPress={onOpenPlan} />
    </PreviewSheet>
  );
}
