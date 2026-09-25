import { progressCircles, streakProgress } from "./streak-progress";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, View, useWindowDimensions } from "react-native";
import { Flame, Rocket, Sprout } from "lucide-react-native";
import { isSameWeek } from "date-fns";
import { useIsFocused } from "expo-router";
import { Reveal, RevealContext } from "@/components/reveal/Reveal";
import { useContext } from "react";
import { useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { dayKey } from "@/core/dates";
import type { PlanProgressStripProps, SteppedProgressProps } from "./types";
function SteppedProgress({
  value,
  max,
  color,
  icon: Icon,
  label,
}: SteppedProgressProps) {
  const c = useColors();
  const { height: screenHeight } = useWindowDimensions();
  const focused = useIsFocused();
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [steps, setSteps] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const view = useRef<View>(null);
  const viewport = useContext(RevealContext);
  const { count, filled, overflow } = progressCircles(value, max);
  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      setSteps(filled);
      return;
    }
    if (steps === filled) return;
    const timer = setTimeout(
      () => setSteps((previous) => (previous < filled ? previous + 1 : filled)),
      300,
    );
    return () => clearTimeout(timer);
  }, [visible, reduced, filled, steps]);
  useEffect(() => {
    if (!focused || reduced || !visible || count === 0 || steps < count) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false,
        }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
      opacity.setValue(1);
    };
  }, [focused, reduced, visible, count, steps, opacity]);
  // Pause repeated celebration when scrolled away, while preserving filled steps.
  useEffect(
    () =>
      viewport?.register(() =>
        view.current?.measureInWindow((_x, y, _w, h) => {
          setVisible(h > 0 && y + h > 0 && y < screenHeight);
        }),
      ),
    [viewport, screenHeight],
  );
  return (
    <Reveal
      onReveal={(reduce) => {
        setReduced(reduce);
        setVisible(true);
      }}
    >
      <View
        ref={view}
        collapsable={false}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Animated.View
          accessibilityRole="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.max(max, value)}
          aria-valuenow={value}
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: Math.max(max, value), now: value }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            opacity,
          }}
        >
          {Array.from({ length: count }, (_, i) =>
            overflow > 0 && i === count - 1 ? (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text
                  style={{
                    color,
                    fontSize: 14,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  +{overflow}
                </Text>
              </View>
            ) : (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i < steps ? color : c.soft,
                }}
              />
            ),
          )}
        </Animated.View>
        <Icon
          size={19}
          color={label === "Weekly progress" ? "#fb923c" : color}
        />
      </View>
    </Reveal>
  );
}
export function PlanProgressStrip({ plan }: PlanProgressStripProps) {
  const week = plan.progress?.weeks?.find((w) =>
    isSameWeek(new Date(w.startDate), new Date()),
  );
  if (!week || !plan.progress?.achievement) return null;
  const progress = streakProgress(plan.progress);
  const missed = plan.progress.achievement.missedLastWeek;
  const habitAchieved = progress.stage === "Lifestyle";
  const max =
    typeof week.plannedActivities === "number"
      ? week.plannedActivities
      : (week.plannedActivities?.length ?? 0);
  const completed = new Set(
    (week.completedActivities ?? []).map((e) => dayKey(e.datetime)),
  ).size;
  return (
    <View
      testID="plan-progress-strip"
      style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}
    >
      <SteppedProgress
        label="Weekly progress"
        value={completed}
        max={max}
        color="#22c55e"
        icon={Flame}
      />
      <SteppedProgress
        label={habitAchieved ? "Lifestyle progress" : "Habit progress"}
        value={progress.streak}
        max={progress.target}
        color={habitAchieved ? "#fbbf24" : "#a3e635"}
        icon={habitAchieved ? Rocket : Sprout}
      />
      {missed && (
        <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
          💔 Missed last week
          {missed.streakBefore > missed.streakAfter
            ? ` · streak ${missed.streakBefore} → ${missed.streakAfter}`
            : ""}
          {missed.inARow > 1 ? ` · ${missed.inARow} weeks in a row` : ""}
        </Text>
      )}
    </View>
  );
}
