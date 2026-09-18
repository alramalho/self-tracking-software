import { View } from "react-native";
import { Stats, StoryText } from "../ui";
import { yearEntries } from "../model";
import type { StoryProps } from "../types";
export function Hero({ data }: StoryProps) {
  const entries = yearEntries(data.entries, data.year);
  return (
    <View style={{ gap: 40, alignItems: "center", paddingVertical: 64 }}>
      <View style={{ gap: 8, width: "100%" }}>
        <StoryText
          title
          size={64}
          style={{ fontSize: 72, textAlign: "center" }}
        >
          Your {data.year}
        </StoryText>
        <StoryText size={18} muted style={{ textAlign: "center" }}>
          A year of growth
        </StoryText>
      </View>
      <Stats
        items={[
          {
            value: new Set(
              entries.map((e) =>
                new Date(e.datetime).toISOString().slice(0, 10),
              ),
            ).size,
            label: "DAYS",
          },
          {
            value: data.annualPlans.reduce(
              (s, p) => s + p.peakStreak,
              0,
            ),
            label: "STREAKS",
          },
          { value: entries.length, label: "ENTRIES" },
        ]}
      />
      <StoryText muted style={{ marginTop: 60 }}>
        Tap to continue
      </StoryText>
    </View>
  );
}
