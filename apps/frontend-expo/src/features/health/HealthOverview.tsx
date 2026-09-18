import { router } from "expo-router";
import { Activity, HeartPulse, Wind, Droplets } from "lucide-react-native";
import { format, parseISO } from "date-fns";
import { Pressable, View } from "react-native";

import { Copy, Heading, Status, s, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";

import { useHealth } from "./HealthProvider";
import { useHealthDailyMetrics } from "./queries";
import { SleepMetric } from "./sleep/SleepMetric";
import {
  baselineAverage,
  formatBaseline,
  formatVitalValue,
  HEALTH_VITALS,
  latestRecord,
  recordsForMetric,
  sparkValues,
} from "./daily-model";
import type { HealthOverviewMetric } from "./daily-types";

const icons: Record<HealthOverviewMetric, typeof Activity> = {
  resting_heart_rate: HeartPulse,
  heart_rate_variability_sdnn: Activity,
  respiratory_rate: Wind,
  oxygen_saturation: Droplets,
};

function dateLabel(value: string | undefined): string {
  if (!value) return "Latest reading";
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return "Latest reading";
  }
}

function VitalSparkline({ values }: { values: number[] }) {
  const c = useColors();
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return (
    <View
      accessible
      accessibilityLabel="Recent readings"
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 3,
        height: 28,
        width: 58,
      }}
    >
      {values.map((value, index) => (
        <View
          key={`${value}-${index}`}
          style={{
            flex: 1,
            minHeight: 3,
            height: 5 + ((value - min) / span) * 20,
            borderRadius: 3,
            backgroundColor: c.accent,
            opacity: index === values.length - 1 ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

function VitalRow({
  metric,
  records,
}: {
  metric: (typeof HEALTH_VITALS)[number];
  records: ReturnType<typeof recordsForMetric>;
}) {
  const c = useColors();
  const Icon = icons[metric.metric];
  const latest = latestRecord(records, metric.metric);
  const baseline = baselineAverage(records, metric.metric);
  const values = sparkValues(records, metric.metric);
  return (
    <View
      accessible
      accessibilityLabel={`${metric.label}, ${formatVitalValue(latest)}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 72,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.soft,
        }}
      >
        <Icon size={19} color={c.muted} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
          {metric.label}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {latest
            ? `${dateLabel(latest.localDate)} · ${formatBaseline(latest, baseline)}`
            : "Waiting for a reading"}
        </Text>
      </View>
      {values.length > 1 && <VitalSparkline values={values} />}
      <Text
        style={{
          color: c.text,
          fontSize: 16,
          fontWeight: "600",
          minWidth: 62,
          textAlign: "right",
        }}
      >
        {formatVitalValue(latest)}
      </Text>
    </View>
  );
}

export function HealthOverview() {
  const health = useHealth();
  const c = useColors();
  const daily = useHealthDailyMetrics();
  const records = daily.data?.metrics ?? [];
  const hasImportedData = !!health.status?.importStats.dailyMetricCount;
  const source =
    records.find((record) => record.sourceName)?.sourceName ??
    "Connected health data";

  return (
    <View style={{ gap: 18 }} testID="metrics-health-view">
      <Copy muted>Sleep and vital trends from your connected health data.</Copy>
      <SleepMetric />
      <View style={{ gap: 8 }}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Heading>Vitals</Heading>
          </View>
          <Copy muted>Last 14 days</Copy>
        </View>
        <View testID="health-vitals" style={{ paddingHorizontal: 2 }}>
          {HEALTH_VITALS.map((metric, index) => (
            <View
              key={metric.metric}
              style={{
                borderTopWidth: index ? 1 : 0,
                borderTopColor: c.border,
              }}
            >
              <VitalRow metric={metric} records={records} />
            </View>
          ))}
          {daily.isPending && <Status loading />}
          {!daily.isPending && !daily.error && !records.length && (
            <View style={{ paddingTop: 10, gap: 8 }}>
              <Copy muted>
                {health.status?.connected ||
                hasImportedData ||
                health.garmin.status?.connected
                  ? "No vital readings have arrived yet. Try syncing your connected health source again."
                  : "Connect Apple Health or Garmin Connect to see your resting heart rate, HRV and respiratory trends here."}
              </Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage health data"
                onPress={() => router.push("/health")}
              >
                <Text style={{ color: c.accent, fontWeight: "600" }}>
                  Manage health data
                </Text>
              </Pressable>
            </View>
          )}
          {!!daily.error && (
            <View style={{ paddingTop: 10, gap: 8 }}>
              <Copy muted>Vitals are temporarily unavailable.</Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading vitals"
                onPress={() => void daily.refetch()}
              >
                <Text style={{ color: c.accent, fontWeight: "600" }}>
                  Try again
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        {!!records.length && <Copy muted>{source} · Private to you</Copy>}
      </View>
    </View>
  );
}
