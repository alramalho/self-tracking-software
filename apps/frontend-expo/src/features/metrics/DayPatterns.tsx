import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import { average } from "./model";
import { weekdayLine } from "./words";
import type { MetricVisualProps } from "./types";

const BAR_HEIGHT = 44;

export function DayPatterns({ entries }: MetricVisualProps) {
  const c = useColors();
  const overall = average(entries) ?? 0;
  const stats = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].map((day, index) => {
    const rows = entries.filter(
      (entry) => new Date(entry.createdAt).getUTCDay() === index,
    );
    const avg = average(rows) ?? 0;
    return {
      day,
      average: avg,
      count: rows.length,
      percent: overall ? ((avg - overall) / overall) * 100 : 0,
    };
  });
  const significant = stats
    .filter((stat) => stat.count >= 3)
    .sort((a, b) => a.percent - b.percent);
  const worst = significant[0],
    best = significant[significant.length - 1];
  if (!best || !worst || best.percent - worst.percent <= 5) return null;
  const named = [
    ...(best.percent > 5 ? [best] : []),
    ...(worst.percent < -5 ? [worst] : []),
  ];
  return (
    <Panel style={{ padding: 20, borderRadius: 16, gap: 12 }}>
      <Text style={{ fontSize: 13, color: c.muted }}>By weekday</Text>
      <Text style={{ fontSize: 17, fontWeight: "600", color: c.text }}>
        {weekdayLine(
          best.percent > 5 ? best.day : undefined,
          worst.percent < -5 ? worst.day : undefined,
        )}
      </Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {stats.map((stat) => (
          <View
            key={stat.day}
            style={{ flex: 1, alignItems: "center", gap: 4 }}
          >
            <View
              style={{
                height: BAR_HEIGHT,
                width: "100%",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  height: stat.count ? (stat.average / 5) * BAR_HEIGHT : 2,
                  backgroundColor: c.accent,
                  // The days the sentence names stand out; the rest recede.
                  opacity: named.includes(stat) ? 1 : 0.3,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ fontSize: 10, color: c.muted }}>
              {stat.day.slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}
