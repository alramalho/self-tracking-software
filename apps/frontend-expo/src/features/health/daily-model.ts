import type { HealthDailyMetricRecord, HealthOverviewMetric } from "./daily-types";

export const HEALTH_VITALS: Array<{
  metric: HealthOverviewMetric;
  label: string;
  unit: string;
  direction: "lower" | "higher" | "neutral";
}> = [
  {
    metric: "resting_heart_rate",
    label: "Resting heart rate",
    unit: "bpm",
    direction: "lower",
  },
  {
    metric: "heart_rate_variability_sdnn",
    label: "Heart rate variability",
    unit: "ms",
    direction: "higher",
  },
  {
    metric: "respiratory_rate",
    label: "Respiratory rate",
    unit: "breaths/min",
    direction: "neutral",
  },
  {
    metric: "oxygen_saturation",
    label: "Blood oxygen",
    unit: "%",
    direction: "higher",
  },
];

export function recordsForMetric(
  records: HealthDailyMetricRecord[],
  metric: HealthOverviewMetric,
): HealthDailyMetricRecord[] {
  return records
    .filter((record) => record.metric === metric)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export function latestRecord(
  records: HealthDailyMetricRecord[],
  metric: HealthOverviewMetric,
): HealthDailyMetricRecord | null {
  return recordsForMetric(records, metric).at(-1) ?? null;
}

export function baselineAverage(
  records: HealthDailyMetricRecord[],
  metric: HealthOverviewMetric,
): number | null {
  const values = recordsForMetric(records, metric)
    .slice(0, -1)
    .slice(-7)
    .map((record) => record.value)
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatVitalValue(
  record: HealthDailyMetricRecord | null,
): string {
  if (!record || !Number.isFinite(record.value)) return "—";
  if (record.metric === "resting_heart_rate") return `${Math.round(record.value)} bpm`;
  if (record.metric === "heart_rate_variability_sdnn") return `${Math.round(record.value)} ms`;
  if (record.metric === "respiratory_rate") return `${record.value.toFixed(1)} /min`;
  return `${record.value.toFixed(0)}%`;
}

export function formatBaseline(
  record: HealthDailyMetricRecord | null,
  baseline: number | null,
): string {
  if (!record || baseline == null || !Number.isFinite(baseline)) return "No usual range yet";
  const difference = record.value - baseline;
  if (Math.abs(difference) < (record.metric === "respiratory_rate" ? 0.1 : 0.5)) {
    return "Near your 7-day average";
  }
  const rounded = record.metric === "respiratory_rate" ? difference.toFixed(1) : Math.round(difference).toString();
  return `${difference > 0 ? "+" : ""}${rounded} vs 7-day average`;
}

export function sparkValues(
  records: HealthDailyMetricRecord[],
  metric: HealthOverviewMetric,
): number[] {
  return recordsForMetric(records, metric).slice(-7).map((record) => record.value);
}
