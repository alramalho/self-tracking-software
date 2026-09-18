import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Copy, Heading, Panel, useColors } from "@/components/ui";
import { average } from "./model";
import type { MetricVisualProps } from "./types";
export function DayPatterns({ metric, entries }: MetricVisualProps) {
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
  return (
    <Panel style={{ padding: 16, borderRadius: 16 }}>
      <Heading>{metric.emoji} Day of Week Patterns</Heading>
      {best.percent > 5 && (
        <Copy>
          {metric.title} is {best.percent.toFixed(0)}% higher on {best.day}s
        </Copy>
      )}
      {worst.percent < -5 && (
        <Copy>
          {metric.title} is {Math.abs(worst.percent).toFixed(0)}% lower on{" "}
          {worst.day}s
        </Copy>
      )}
      <View style={{ flexDirection: "row", gap: 4 }}>
        {stats.map((stat) => (
          <View
            key={stat.day}
            style={{ flex: 1, alignItems: "center", gap: 4 }}
          >
            <View
              style={{ height: 64, width: "100%", justifyContent: "flex-end" }}
            >
              <View
                style={{
                  height: stat.count
                    ? Math.max((stat.average / 10) * 64, 6.4)
                    : 1,
                  backgroundColor:
                    stat === best
                      ? "#22c55e"
                      : stat === worst
                        ? "#f87171"
                        : c.muted,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                }}
              />
            </View>
            <Text style={{ fontSize: 10, color: c.muted }}>
              {stat.day.slice(0, 3)}
            </Text>
            <Text style={{ fontSize: 10, color: c.muted }}>
              {stat.count ? stat.average.toFixed(1) : "—"}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}
