// Same thresholds and baseline windows as the Vite metrics context.
import type { MetricEntry } from "@/core/types";
import type { MetricContextEvent, MetricEventImpact } from "./types";
import { addDays, endOfDay, isSameDay, startOfDay, subDays } from "date-fns";
import { parseLocalDate } from "@/core/dates";
import { metricDayKey, validRatings } from "./model";
const MINIMUM_ENTRIES = 7;
const EVENT_BASELINE_WINDOW_DAYS = 30;
const MINIMUM_EVENT_RANGE_ENTRIES = 2;
const MINIMUM_SINGLE_DAY_EVENT_ENTRIES = 1;
const MINIMUM_EVENT_BASELINE_ENTRIES = 5;
const MINIMUM_EVENT_DELTA = 0.7;

const averageRating = (entries: MetricEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length;

const resolveEventRange = (event: MetricContextEvent) => {
  const rawStart = event.occurredAt || event.endedAt;
  if (!rawStart) return null;

  const start = startOfDay(new Date(rawStart));
  const end = endOfDay(new Date(event.endedAt || rawStart));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return start <= end
    ? { startedAt: start, endedAt: end }
    : { startedAt: startOfDay(end), endedAt: endOfDay(start) };
};

export const getMetricEventImpacts = (
  metricId: string,
  entries: MetricEntry[],
  events: MetricContextEvent[],
): MetricEventImpact[] => {
  const metricEntries = validRatings(entries)
    .filter((entry) => entry.metricId === metricId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  if (metricEntries.length < MINIMUM_ENTRIES) return [];

  return events
    .map((event) => {
      const range = resolveEventRange(event);
      if (!range) return null;

      const { startedAt, endedAt } = range;
      const duringEntries = metricEntries.filter((entry) => {
        const entryDate = parseLocalDate(metricDayKey(entry.createdAt));
        return entryDate >= startedAt && entryDate <= endedAt;
      });
      const eventSpansMultipleDays = !isSameDay(startedAt, endedAt);
      const minimumDuringEntries = eventSpansMultipleDays
        ? MINIMUM_EVENT_RANGE_ENTRIES
        : MINIMUM_SINGLE_DAY_EVENT_ENTRIES;

      if (duringEntries.length < minimumDuringEntries) return null;

      const baselineStart = subDays(startedAt, EVENT_BASELINE_WINDOW_DAYS);
      const baselineEnd = addDays(endedAt, EVENT_BASELINE_WINDOW_DAYS);
      let baselineEntries = metricEntries.filter((entry) => {
        const entryDate = parseLocalDate(metricDayKey(entry.createdAt));
        const isInsideEvent = entryDate >= startedAt && entryDate <= endedAt;
        const isInsideWindow =
          entryDate >= baselineStart && entryDate <= baselineEnd;
        return !isInsideEvent && isInsideWindow;
      });

      if (baselineEntries.length < MINIMUM_EVENT_BASELINE_ENTRIES) {
        baselineEntries = metricEntries.filter((entry) => {
          const entryDate = parseLocalDate(metricDayKey(entry.createdAt));
          return entryDate < startedAt || entryDate > endedAt;
        });
      }

      if (baselineEntries.length < MINIMUM_EVENT_BASELINE_ENTRIES) return null;

      const duringAverage = averageRating(duringEntries);
      const baselineAverage = averageRating(baselineEntries);
      const delta = duringAverage - baselineAverage;

      if (Math.abs(delta) < MINIMUM_EVENT_DELTA) return null;

      return {
        event,
        duringAverage,
        baselineAverage,
        delta,
        duringEntryCount: duringEntries.length,
        baselineEntryCount: baselineEntries.length,
        startedAt,
        endedAt,
      };
    })
    .filter((impact): impact is MetricEventImpact => impact !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
};
