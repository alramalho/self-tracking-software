import { subDays } from "date-fns";

import { prisma } from "@/utils/prisma";

import {
  APPLE_HEALTH_PROVIDER,
  HEALTHKIT_MERGED_SOURCE,
} from "./types";

export const HEALTH_OVERVIEW_METRICS = [
  "resting_heart_rate",
  "heart_rate_variability_sdnn",
  "respiratory_rate",
  "oxygen_saturation",
] as const;

export type HealthOverviewMetric = (typeof HEALTH_OVERVIEW_METRICS)[number];

export interface AppleHealthDailyMetricRecord {
  localDate: string;
  metric: HealthOverviewMetric;
  aggregation: string;
  value: number;
  unit: string;
  provider: string;
  sourceName: string | null;
  sampleCount: number | null;
}

export interface AppleHealthDailyMetricsResponse {
  metrics: AppleHealthDailyMetricRecord[];
}

export async function getAppleHealthDailyMetrics(
  userId: string,
  days = 14,
): Promise<AppleHealthDailyMetricsResponse> {
  const startDate = subDays(new Date(), Math.max(1, days - 1))
    .toISOString()
    .slice(0, 10);

  const rows = await prisma.healthDailyMetric.findMany({
    where: {
      userId,
      provider: APPLE_HEALTH_PROVIDER,
      sourceBundleId: HEALTHKIT_MERGED_SOURCE,
      localDate: { gte: startDate },
      metric: { in: [...HEALTH_OVERVIEW_METRICS] },
    },
    orderBy: [{ localDate: "asc" }, { metric: "asc" }],
    select: {
      localDate: true,
      metric: true,
      aggregation: true,
      value: true,
      unit: true,
      provider: true,
      sourceName: true,
      sampleCount: true,
    },
  });

  return {
    metrics: rows as AppleHealthDailyMetricRecord[],
  };
}
