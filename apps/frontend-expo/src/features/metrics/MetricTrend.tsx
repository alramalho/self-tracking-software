import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { subDays } from "date-fns";
import { Text } from "@/components/typography/Text";
import { Copy, Panel, useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import { PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import { dailyRatings, metricSummary } from "./model";
import { trendLine } from "./words";
import type { MetricVisualProps } from "./types";

const BAR_HEIGHT = 44;

// One line and one shape: the last fourteen days, last week faded. The two
// averages sit behind a tap.
export function MetricTrend({ metric, entries }: MetricVisualProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const summary = metricSummary(entries);
  const ratings = dailyRatings(entries);
  const line = trendLine(summary);
  const days = Array.from(
    { length: 14 },
    (_, i) => ratings.get(dayKey(subDays(new Date(), 13 - i))) ?? 0,
  );
  return (
    <Panel style={{ padding: 20, borderRadius: 16, gap: 12 }}>
      <Pressable
        testID="metric-trend"
        accessibilityRole="button"
        accessibilityLabel={`${metric.title} this week: ${line}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontSize: 13, color: c.muted }}>
            This week
          </Text>
          <ChevronRight size={18} color={c.muted} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: "600", color: c.text }}>
          {line}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 4,
            height: BAR_HEIGHT,
          }}
        >
          {days.map((rating, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                // A day without a rating keeps a hairline so the week reads
                // as seven days.
                height: rating ? (rating / 5) * BAR_HEIGHT : 2,
                borderRadius: 3,
                backgroundColor: c.accent,
                opacity: i < 7 ? 0.3 : 1,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: c.muted }}>Last week</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>This week</Text>
        </View>
      </Pressable>
      <PreviewSheet
        visible={open}
        title={`${metric.title} this week`}
        onClose={() => setOpen(false)}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: c.text,
            paddingRight: 36,
          }}
        >
          {metric.emoji} {line}
        </Text>
        <Copy>
          This week:{" "}
          {summary.currentAverage?.toFixed(1) ?? "no check-ins yet"}
        </Copy>
        <Copy>
          Last week: {summary.previousAverage?.toFixed(1) ?? "no check-ins"}
        </Copy>
        <Copy muted>
          Average rating out of 5, over the last seven days and the seven
          before. Skipped and missing days are left out.
        </Copy>
      </PreviewSheet>
    </Panel>
  );
}
