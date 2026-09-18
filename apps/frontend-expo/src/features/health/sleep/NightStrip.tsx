import { Pressable, View } from "react-native";
import { format } from "date-fns";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { asDate } from "@/core/dates";
import type { NightStripProps } from "./types";

// The same 8-hour reference the duration component scores against, so the
// strip reads as one chart of how long you slept rather than a row of dashes
// while the score is still being learned.
const REFERENCE_MINUTES = 8 * 60;
const BAR_HEIGHT = 34;

// Mirrors the check-in strip: one column per recorded night with the selected
// night called out. The bar is time asleep; the number is the night's score,
// shown as a dash rather than a zero until we can compare your bedtime.
export function NightStrip({ scores, selectedDate, onSelect }: NightStripProps) {
  const c = useColors();
  const nights = scores.slice(0, 7).reverse();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}
    >
      {nights.map((score) => {
        const selected = score.date === selectedDate;
        const asleep = Math.max(
          0,
          Math.min(score.asleepMinutes, REFERENCE_MINUTES),
        );
        return (
          <Pressable
            key={score.date}
            accessibilityRole="button"
            accessibilityLabel={`Sleep on ${score.date}`}
            accessibilityHint={`${Math.round(score.asleepMinutes)} minutes asleep`}
            accessibilityState={{ selected }}
            aria-pressed={selected}
            onPress={() => onSelect(score.date)}
            style={({ pressed }) => ({
              flex: 1,
              gap: 4,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              alignItems: "center",
              borderColor: selected ? c.selectedBorder : c.border,
              backgroundColor: selected ? c.selectedBg : c.card,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              accessibilityRole="progressbar"
              aria-valuemin={0}
              aria-valuemax={REFERENCE_MINUTES}
              aria-valuenow={Math.round(score.asleepMinutes)}
              accessibilityLabel={`Time asleep on ${score.date}`}
              accessibilityValue={{
                min: 0,
                max: REFERENCE_MINUTES,
                now: Math.round(score.asleepMinutes),
              }}
              style={{
                height: BAR_HEIGHT,
                width: 6,
                borderRadius: 999,
                overflow: "hidden",
                justifyContent: "flex-end",
                backgroundColor: c.soft,
              }}
            >
              <View
                style={{
                  width: "100%",
                  backgroundColor: c.accent,
                  height: `${(asleep / REFERENCE_MINUTES) * 100}%`,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: score.total == null ? c.muted : c.text,
              }}
            >
              {score.total ?? "—"}
            </Text>
            <Text style={{ fontSize: 11, color: c.muted }}>
              {format(asDate(score.date), "EEE")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
