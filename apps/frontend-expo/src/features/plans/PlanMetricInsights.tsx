import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Activity } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Copy, Heading, Sheet, useColors } from "@/components/ui";
import { useMetricEntries, useMetrics } from "@/data/queries";
import { MetricInsights } from "../metrics/MetricInsights";
import { correlations, metricsWithInsights } from "../metrics/model";
import type { PlanMetricInsightsProps } from "./types";

export function PlanMetricInsights({ plan, entries }: PlanMetricInsightsProps) {
  const c = useColors();
  const metrics = useMetrics();
  const metricEntries = useMetricEntries();
  const [help, setHelp] = useState(false);
  const ready = metricsWithInsights(metrics.data ?? [], metricEntries.data ?? []);
  if (!ready.length || !plan.activities.length) return null;
  return (
    <View testID="plan-metric-insights" style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Heading>Metrics Insights</Heading>
        <Copy muted>
          See how this plan's activities correlate with your tracked metrics
        </Copy>
      </View>
      {ready.map((metric) => (
        <MetricInsights
          key={metric.id}
          metric={metric}
          correlations={correlations(
            metricEntries.data?.filter((entry) => entry.metricId === metric.id) ?? [],
            plan.activities,
            entries,
          )}
          onHelp={() => setHelp(true)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/metrics")}
        style={({ pressed }) => ({
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderRadius: 16,
          backgroundColor: c.soft,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Activity size={20} color={c.muted} />
        <Text style={{ fontSize: 14, fontWeight: "500", color: c.text }}>
          See full metrics dashboard
        </Text>
      </Pressable>
      <Sheet
        visible={help}
        title="Understanding correlations"
        onClose={() => setHelp(false)}
      >
        <Copy>
          Correlations compare ratings with activities in the preceding day.
          Positive values mean an activity tends to accompany higher ratings;
          negative values mean lower ratings. Correlation does not establish
          cause. More observations make patterns more reliable.
        </Copy>
      </Sheet>
    </View>
  );
}
