import { View } from "react-native";
import { HABIT_WEEKS, LIFESTYLE_WEEKS } from "@tsw/prisma/follow-through/streak";
import type { WeekOutcome } from "@tsw/prisma/follow-through/streak";
import { Text } from "@/components/typography/Text";
import { Copy, useColors } from "@/components/ui";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import type { StreakExplainerProps } from "./grid-types";
import { exampleTarget, recentStreakWeeks, streakExamples } from "./streak-explainer";

const GREEN = "#22c55e";
const RED = "#ef4444";

/** The same mark the grid shows under a week: a flame, a small faded flame, or what it cost. */
function OutcomeMark({ outcome }: { outcome: WeekOutcome }) {
  if (outcome === "missed")
    return <Text style={{ color: RED, fontSize: 15, fontWeight: "700", lineHeight: 24 }}>−1</Text>;
  return (
    <Text
      style={{
        fontSize: outcome === "held" ? 13 : 20,
        lineHeight: 24,
        opacity: outcome === "held" ? 0.45 : 1,
      }}
    >
      🔥
    </Text>
  );
}

/** Opens from the flame under a plan's grid: what a week does to the streak, then the plan's own weeks. */
export function StreakExplainer({ plan, onClose }: StreakExplainerProps) {
  const c = useColors();
  const streak = plan.progress?.achievement?.streak ?? 0;
  const examples = streakExamples(exampleTarget(plan));
  const weeks = recentStreakWeeks(plan);
  return (
    <LoggingDrawer
      testID="streak-explainer"
      dismissLabel="Dismiss streak explainer"
      title={`🔥 ${streak} week streak`}
      onClose={onClose}
    >
      <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: c.card }}>
        {examples.map((row, index) => (
          <View
            key={row.outcome}
            testID={`streak-example-${row.outcome}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: index ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <View style={{ flex: 1, gap: 8 }}>
              <View
                accessibilityLabel={`${row.done} of ${row.target} sessions`}
                style={{ flexDirection: "row", gap: 5 }}
              >
                {Array.from({ length: row.target }, (_, dot) => (
                  <View
                    key={dot}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: dot < row.done ? GREEN : c.soft,
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{row.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{row.detail}</Text>
            </View>
            <View style={{ alignItems: "center", minWidth: 52, gap: 2 }}>
              {row.outcome !== "missed" && <OutcomeMark outcome={row.outcome} />}
              <Text
                style={{
                  fontSize: row.outcome === "held" ? 13 : 20,
                  fontWeight: "700",
                  color: row.outcome === "complete" ? GREEN : row.outcome === "missed" ? RED : c.muted,
                }}
              >
                {row.change}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {weeks.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>Your last weeks</Text>
          <View testID="streak-recent-weeks" style={{ flexDirection: "row" }}>
            {weeks.map((week) => (
              <View
                key={week.key}
                accessibilityLabel={`Week of ${week.label}: ${week.done} of ${week.target}, ${week.outcome}`}
                style={{ flex: 1, alignItems: "center", gap: 2 }}
              >
                <OutcomeMark outcome={week.outcome} />
                <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
                  {week.done}/{week.target}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>{week.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <Copy muted>
        {`${HABIT_WEEKS} weeks make it a Habit, ${LIFESTYLE_WEEKS} a Lifestyle.`}
      </Copy>
    </LoggingDrawer>
  );
}
