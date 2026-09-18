import {
  addDays,
  addWeeks,
  differenceInWeeks,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { asDate, dayKey } from "@/core/dates";
import type { ActivityEntry } from "@/core/types";
import type { HeatmapInput, HeatmapModel } from "./grid-types";
export function buildHeatmap({
  activities,
  entries,
  plan,
  now = new Date(),
  startDate,
  endDate,
  premium = false,
}: HeatmapInput): HeatmapModel {
  const ids = new Set(activities.map((a) => a.id));
  const relevant = entries
    .filter(
      (e) =>
        !e.deletedAt &&
        e.activityId &&
        ids.has(e.activityId) &&
        Number.isFinite(asDate(e.datetime).getTime()),
    )
    .slice()
    .sort(
      (a, b) => asDate(a.datetime).getTime() - asDate(b.datetime).getTime(),
    );
  let start = startDate
    ? asDate(startDate)
    : relevant.length
      ? startOfWeek(asDate(relevant[0].datetime))
      : subWeeks(now, 2);
  const historyLimited = !premium && start < subDays(startOfDay(now), 180);
  if (historyLimited) start = subDays(startOfDay(now), 180);
  start = startOfWeek(start);
  let end = endDate ? asDate(endDate) : addWeeks(now, 1);
  if (!endDate && differenceInWeeks(end, start) < 5) end = addWeeks(start, 5);
  const byDate = new Map<string, ActivityEntry[]>();
  const ranges = new Map<string, { min: number; max: number }>();
  relevant.forEach((entry) => {
    const key = dayKey(entry.datetime);
    byDate.set(key, [...(byDate.get(key) ?? []), entry]);
    const range = ranges.get(entry.activityId!);
    ranges.set(entry.activityId!, {
      min: Math.min(range?.min ?? Infinity, entry.quantity),
      max: Math.max(range?.max ?? -Infinity, entry.quantity),
    });
  });
  const completeWeeks = new Set(
    plan?.progress?.weeks
      ?.filter((w) => w.isCompleted)
      .map((w) => dayKey(startOfWeek(asDate(w.startDate)))) ?? [],
  );
  const weeks = [];
  for (let week = start; week <= end; week = addWeeks(week, 1)) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i);
      const key = dayKey(date);
      const dayEntries = byDate.get(key) ?? [];
      return {
        date,
        key,
        entries: dayEntries,
        today: key === dayKey(now),
        paused: !!plan?.pauseHistory?.some(
          (p) => key >= dayKey(p.pausedAt) && key <= dayKey(p.resumedAt ?? now),
        ),
        segments: dayEntries.map((entry) => {
          const range = ranges.get(entry.activityId!)!;
          return {
            activity: activities.find((a) => a.id === entry.activityId)!,
            entryId: entry.id,
            intensity: Math.min(
              4,
              Math.max(
                0,
                Math.floor(
                  (entry.quantity - range.min) /
                    (Math.max(range.max - range.min, 1) / 5),
                ),
              ),
            ),
          };
        }),
      };
    });
    weeks.push({
      key: dayKey(week),
      date: week,
      days,
      completed: completeWeeks.has(dayKey(week)),
    });
  }
  return { weeks, historyLimited, startDate: start, endDate: end };
}
const colors = [
  ["#9AE6B4", "#68D391", "#48BB78", "#38A169", "#2F855A"],
  ["#BEE3F8", "#90CDF4", "#63B3ED", "#4299E1", "#3182CE"],
  ["#FEB2B2", "#FC8181", "#F56565", "#E53E3E", "#C53030"],
  ["#FAF089", "#F6E05E", "#ECC94B", "#D69E2E", "#B7791F"],
  ["#E9D8FD", "#D6BCFA", "#B794F4", "#9F7AEA", "#805AD5"],
  ["#FED7E2", "#FBB6CE", "#F687B3", "#ED64A6", "#D53F8C"],
  ["#C3DAFE", "#A3BFFA", "#7F9CF5", "#667EEA", "#5A67D8"],
  ["#E2E8F0", "#CBD5E0", "#A0AEC0", "#718096", "#4A5568"],
];
const darkColors = [
  ["#065F46", "#047857", "#059669", "#10B981", "#34D399"],
  ["#075985", "#0369A1", "#0284C7", "#0EA5E9", "#38BDF8"],
  ["#991B1B", "#B91C1C", "#DC2626", "#EF4444", "#F87171"],
  ["#854D0E", "#A16207", "#CA8A04", "#EAB308", "#FACC15"],
  ["#5B21B6", "#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA"],
  ["#9F1239", "#BE185D", "#DB2777", "#EC4899", "#F472B6"],
  ["#3730A3", "#4338CA", "#4F46E5", "#6366F1", "#818CF8"],
  ["#1E293B", "#334155", "#475569", "#64748B", "#94A3B8"],
];
export function activityColor(
  index: number,
  intensity: number,
  custom?: string | null,
  dark = false,
) {
  const level = Math.min(4, Math.max(0, intensity));
  if (custom && /^#[\da-f]{6}$/i.test(custom))
    return `${custom}${["66", "8c", "b3", "d9", "ff"][level]}`;
  return (dark ? darkColors : colors)[Math.max(0, index) % colors.length][
    level
  ];
}
