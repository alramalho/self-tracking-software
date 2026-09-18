import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SleepComponentRow, SleepBreakdownProps } from "./types";

const points = (value: number | null, maximum: number) =>
  `${value ?? "—"}/${maximum}`;

export const sleepComponentRows = (
  score: SleepBreakdownProps["score"],
): SleepComponentRow[] => [
  {
    label: "Duration",
    value: points(score.durationPoints, 50),
    detail: "Compared with an 8-hour reference.",
    earned: score.durationPoints,
    maximum: 50,
  },
  {
    label: "Consistency",
    value: points(score.consistencyPoints, 30),
    detail:
      score.bedtimeDeviationMinutes == null
        ? "Needs seven earlier nights to compare your bedtime."
        : `${Math.round(score.bedtimeDeviationMinutes)} min from your usual bedtime.`,
    earned: score.consistencyPoints,
    maximum: 30,
  },
  {
    label: "Interruptions",
    value: points(score.interruptionPoints, 20),
    detail:
      score.interruptionPoints == null
        ? "Recorded awake time was not detailed for this night."
        : `${Math.round(score.awakeMinutes)} recorded awake minutes.`,
    earned: score.interruptionPoints,
    maximum: 20,
  },
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
        height: 8,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: c.soft,
      }}
    >
      {earned != null && (
        <View
          style={{
            height: "100%",
            backgroundColor: c.accent,
            width: `${(Math.min(Math.max(earned, 0), row.maximum) / row.maximum) * 100}%`,
          }}
        />
      )}
    </View>
  );
}

export function SleepBreakdown({ score }: SleepBreakdownProps) {
  const c = useColors();
  return (
    <View testID="sleep-breakdown" style={{ gap: 14 }}>
      {sleepComponentRows(score).map((row) => (
        <View key={row.label} style={{ gap: 6 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
              {row.label}
            </Text>
            <Text style={{ fontSize: 15, color: c.text }}>{row.value}</Text>
          </View>
          <ScoreBar row={row} />
          <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
            {row.detail}
          </Text>
        </View>
      ))}
    </View>
  );
}
