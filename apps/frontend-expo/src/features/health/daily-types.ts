export type HealthOverviewMetric =
  | "resting_heart_rate"
  | "heart_rate_variability_sdnn"
  | "respiratory_rate"
  | "oxygen_saturation";

export interface HealthDailyMetricRecord {
  localDate: string;
  metric: HealthOverviewMetric;
  aggregation: string;
  value: number;
  unit: string;
  provider: string;
  sourceName?: string | null;
  sampleCount?: number | null;
}

export interface HealthDailyMetricsResponse {
  metrics?: HealthDailyMetricRecord[];
}
