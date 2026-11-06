import AsyncStorage from "@react-native-async-storage/async-storage";
import { dayKey } from "@/core/dates";
import type { Metric, MetricEntry } from "@/core/types";
import { metricDayKey } from "./model";

// After a log the app offers the daily metrics check-in. Someone who closes it
// without rating this many times in a row stops being asked after logs; rating
// metrics again (from anywhere MetricLogger is used) brings the prompt back.
export const skipsBeforeQuiet = 3;

const key = (userId: string) => `metric-prompt-skips:${userId}`;

export async function readMetricPromptSkips(userId: string) {
  try {
    return Number(await AsyncStorage.getItem(key(userId))) || 0;
  } catch {
    return 0;
  }
}

export async function recordMetricPromptSkip(userId: string) {
  const skips = (await readMetricPromptSkips(userId)) + 1;
  await AsyncStorage.setItem(key(userId), String(skips)).catch(() => {});
  return skips;
}

export async function resetMetricPromptSkips(userId: string) {
  await AsyncStorage.removeItem(key(userId)).catch(() => {});
}

export function checkedInToday(metrics: Metric[], entries: MetricEntry[]) {
  const today = dayKey(new Date());
  return metrics.every((metric) =>
    entries.some(
      (entry) =>
        entry.metricId === metric.id &&
        !entry.skipped &&
        metricDayKey(entry.date ?? entry.createdAt) === today,
    ),
  );
}
