import { Pressable, View } from "react-native";
import { format } from "date-fns";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { asDate } from "@/core/dates";
import type { NightStripProps } from "./types";

// The same 8-hour reference the duration component scores against, so a full
// bar means a full night.
const REFERENCE_MINUTES = 8 * 60;
const BAR_HEIGHT = 72;
const MIN_BAR = 4;

// A bar chart of time asleep, one bar per recorded night. The selected night
// is the solid bar; the others are dimmed. Its score shows in the hero above.
export function NightStrip({ scores, selectedDate, onSelect }: NightStripProps) {
  const c = useColors();
  const nights = scores.slice(0, 7).reverse();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>
      {nights.map((score) => {
        const selected = score.date === selectedDate;
        const asleep = Math.max(
          0,
          Math.min(score.asleepMinutes, REFERENCE_MINUTES),
        );
        const height = Math.max(MIN_BAR, (asleep / REFERENCE_MINUTES) * BAR_HEIGHT);
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
              gap: 8,
              alignItems: "center",
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
              style={{ height: BAR_HEIGHT, justifyContent: "flex-end" }}
            >
              <View
                style={{
                  width: 14,
                  height,
                  borderRadius: 7,
                  backgroundColor: c.accent,
                  opacity: selected ? 1 : 0.35,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: selected ? "600" : "400",
                color: selected ? c.text : c.muted,
              }}
            >
              {format(asDate(score.date), "EEE")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
