import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { CircleHelp, TrendingUp, TrendingDown } from "lucide-react-native";
import { subDays } from "date-fns";
import {
  Panel,
  Heading,
  Copy,
  IconButton,
  Sheet,
  s,
  useColors,
} from "@/components/ui";
import { dayKey } from "@/core/dates";
import { dailyRatings, metricSummary } from "./model";
import type { MetricVisualProps } from "./types";
export function MetricTrend({ metric, entries }: MetricVisualProps) {
  const c = useColors();
  const [help, setHelp] = useState(false);
  const summary = metricSummary(entries);
  const ratings = dailyRatings(entries);
  const Icon = (summary.trend ?? 0) >= 0 ? TrendingUp : TrendingDown;
  const color = (summary.trend ?? 0) >= 0 ? "#22c55e" : "#ef4444";
  return (
    <Panel style={{ padding: 24, borderRadius: 16 }}>
      <View style={s.row}>
        <Text style={{ fontSize: 36 }}>{metric.emoji}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Heading>{metric.title} Trend</Heading>
          <View style={s.row}>
            <Icon size={16} color={color} />
            <Text style={{ color, fontSize: 14 }}>
              {summary.trend === null
                ? "—"
                : `${Math.abs(summary.trend).toFixed(1)}%`}
            </Text>
            <Copy muted>Last 14 days</Copy>
          </View>
        </View>
        <IconButton
          label="About metric trends"
          icon={CircleHelp}
          onPress={() => setHelp(true)}
        />
      </View>
      <View>
        <Copy muted>
          This week's avg: {summary.currentAverage?.toFixed(2) ?? "No data"}
        </Copy>
        <Copy muted>
          Last week's avg: {summary.previousAverage?.toFixed(2) ?? "No data"}
        </Copy>
      </View>
      {[0, 1].map((week) => (
        <View key={week} style={{ gap: 4, opacity: week ? 0.5 : 1 }}>
          <Copy muted>{week ? "Last week" : "This week"}</Copy>
          <View
            style={{
              flexDirection: "row",
              gap: 4,
              alignItems: "flex-end",
              height: 40,
            }}
          >
            {Array.from(
              { length: 7 },
              (_, i) =>
                ratings.get(dayKey(subDays(new Date(), week * 7 + 6 - i))) ?? 0,
            ).map((rating, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: rating ? rating * 8 : 1,
                  borderRadius: 2,
                  backgroundColor: "#bbf7d0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    position: "absolute",
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: "500",
                    color: rating < 2 ? c.text : "#15803d",
                    // Small bars keep their true scale; place labels above them
                    // so native text layout does not clip low ratings.
                    bottom:
                      rating >= 2 ? (rating * 8 - 16) / 2 : rating * 8 + 2,
                  }}
                >
                  {rating ? Number(rating.toFixed(1)) : "—"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Sheet
        visible={help}
        title="Understanding your trend"
        onClose={() => setHelp(false)}
      >
        <Copy>
          Your trend compares average ratings from the most recent seven days
          with the previous seven days. Positive percentages indicate an
          increase. Missing and skipped ratings are excluded.
        </Copy>
      </Sheet>
    </Panel>
  );
}
