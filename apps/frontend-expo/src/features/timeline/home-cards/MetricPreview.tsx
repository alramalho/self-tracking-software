import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { subDays } from "date-fns";
import { dayKey } from "@/core/dates";
import { Button, useColors } from "@/components/ui";
import type { MetricPreviewProps } from "./types";
export function MetricPreview({ metrics, entries, onLog }: MetricPreviewProps) {
  const c = useColors();
  const days = Array.from({ length: 4 }, (_, i) =>
    dayKey(subDays(new Date(), 3 - i)),
  );
  const logged = (metricId: string, date: string) =>
    entries.some(
      (entry) =>
        entry.metricId === metricId &&
        new Date(entry.createdAt).toISOString().slice(0, 10) === date &&
        (entry.rating > 0 || entry.skipped),
    );
  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: 24,
        padding: 16,
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: 1,
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>
          Metrics
        </Text>
        {metrics.slice(0, 4).map((metric) => (
          <View
            key={metric.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Text style={{ fontSize: 14, width: 20 }}>{metric.emoji}</Text>
            {days.map((date) => (
              <View
                key={date}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: logged(metric.id, date) ? "#22c55e" : c.soft,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Button secondary onPress={onLog}>
        {metrics.every((metric) => logged(metric.id, days[3]))
          ? "Log again"
          : "Log"}
      </Button>
    </View>
  );
}
