import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Flame, Rocket, Sprout } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { progressCircles } from "@/features/plans/streak-progress";
import type { HomeProgressProps, HomeStepsProps } from "./types";

// Under the two weeks: one thin line per plan, this week's sessions then the streak. The plan's page has the full strip.
const WEEK = "#22c55e";
const HABIT = "#a3e635";
const LIFESTYLE = "#fbbf24";

function Steps({ value, target, color, label }: HomeStepsProps) {
  const c = useColors();
  const { count, filled, overflow } = progressCircles(value, target);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.max(target, value), now: value }}
      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 3 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < filled ? color : c.soft }} />
      ))}
      {overflow > 0 && <Text style={{ color, fontSize: 11, fontWeight: "700" }}>+{overflow}</Text>}
    </View>
  );
}

export function HomeProgress({ rows }: HomeProgressProps) {
  if (!rows.length) return null;
  return (
    <View testID="home-progress" style={{ gap: 2 }}>
      {rows.map((row) => {
        const lifestyle = row.streak.stage === "Lifestyle";
        const StreakIcon = lifestyle ? Rocket : Sprout;
        return (
          <Pressable
            key={row.planId}
            testID={`home-progress-${row.planId}`}
            accessibilityRole="button"
            accessibilityLabel={`${row.goal}: ${row.week.done} of ${row.week.target} this week, ${row.streak.value} of ${row.streak.target} weeks towards ${row.streak.stage}`}
            onPress={() => router.push({ pathname: "/(tabs)/plans", params: { selectedPlan: row.planId } })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 3,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ width: 22, textAlign: "center", fontSize: 15, lineHeight: 20 }}>{row.emoji}</Text>
            <Steps value={row.week.done} target={row.week.target} color={WEEK} label="This week" />
            <Flame size={14} color="#fb923c" />
            <View style={{ width: 4 }} />
            <Steps
              value={row.streak.value}
              target={row.streak.target}
              color={lifestyle ? LIFESTYLE : HABIT}
              label={lifestyle ? "Lifestyle progress" : "Habit progress"}
            />
            <StreakIcon size={14} color={lifestyle ? LIFESTYLE : HABIT} />
          </Pressable>
        );
      })}
    </View>
  );
}
