import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SleepComponentRow, SleepBreakdownProps } from "./types";

export const sleepComponentRows = (
  score: SleepBreakdownProps["score"],
): SleepComponentRow[] => [
  { label: "Duration", earned: score.durationPoints, maximum: 50 },
  { label: "Consistency", earned: score.consistencyPoints, maximum: 30 },
  { label: "Interruptions", earned: score.interruptionPoints, maximum: 20 },
];

// Each component is drawn against its own fixed point budget, so a component
// still being learned shows an empty track instead of reading as a zero score.
function ScoreBar({ row }: { row: SleepComponentRow }) {
  const c = useColors();
  const earned = row.earned;
  return (
    <View
      accessibilityRole="progressbar"
      aria-valuemin={0}
      aria-valuemax={row.maximum}
      aria-valuenow={earned ?? 0}
      accessibilityLabel={`${row.label} score`}
      accessibilityValue={{ min: 0, max: row.maximum, now: earned ?? 0 }}
      style={{
        height: 6,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: c.soft,
      }}
    >
      {earned != null && (
        <View
          style={{
            height: "100%",
            borderRadius: 999,
            backgroundColor: c.accent,
            width: `${(Math.min(Math.max(earned, 0), row.maximum) / row.maximum) * 100}%`,
          }}
        />
      )}
    </View>
  );
}

// Three compact rows: name, points and a bar. What each component measures
// lives in the help sheet so the card reads at a glance.
export function SleepBreakdown({ score }: SleepBreakdownProps) {
  const c = useColors();
  return (
    <View testID="sleep-breakdown" style={{ gap: 14 }}>
      {sleepComponentRows(score).map((row) => (
        <View key={row.label} style={{ gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 15, color: c.text }}>{row.label}</Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: row.earned == null ? c.muted : c.text,
              }}
            >
              {row.earned ?? "—"}
              <Text style={{ fontWeight: "400", color: c.muted }}>
                /{row.maximum}
              </Text>
            </Text>
          </View>
          <ScoreBar row={row} />
        </View>
      ))}
    </View>
  );
}
