import { Card } from "@/components/ui/card";
import { type MetricEntry } from "@tsw/prisma";
import { getDay } from "date-fns";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import React, { useMemo } from "react";

interface DayOfWeekInsightsProps {
  entries: MetricEntry[];
  metricTitle: string;
  metricEmoji: string;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayStats {
  day: string;
  shortDay: string;
  average: number;
  count: number;
  percentDiff: number;
}

export const DayOfWeekInsights: React.FC<DayOfWeekInsightsProps> = ({
  entries,
  metricTitle,
  metricEmoji,
}) => {
  const dayStats = useMemo(() => {
    // Group entries by day of week
    const dayGroups: { [key: number]: number[] } = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    entries.forEach((entry) => {
      const dayOfWeek = getDay(new Date(entry.createdAt));
      dayGroups[dayOfWeek].push(entry.rating);
    });

    // Calculate overall average
    const allRatings = entries.map((e) => e.rating);
    const overallAverage =
      allRatings.length > 0
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        : 0;

    // Calculate stats for each day
    const stats: DayStats[] = DAYS_OF_WEEK.map((day, index) => {
      const ratings = dayGroups[index];
      const average =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;
      const percentDiff =
        overallAverage > 0
          ? ((average - overallAverage) / overallAverage) * 100
          : 0;

      return {
        day,
        shortDay: SHORT_DAYS[index],
        average,
        count: ratings.length,
        percentDiff,
      };
    });

    return { stats, overallAverage };
  }, [entries]);

  // Find best and worst days (only if they have at least 3 data points)
  const significantDays = dayStats.stats.filter((d) => d.count >= 3);
  const bestDay = significantDays.length > 0
    ? significantDays.reduce((best, curr) =>
        curr.percentDiff > best.percentDiff ? curr : best
      )
    : null;
  const worstDay = significantDays.length > 0
    ? significantDays.reduce((worst, curr) =>
        curr.percentDiff < worst.percentDiff ? curr : worst
      )
    : null;

  // Only show insights if there's meaningful variation (>5% difference)
  const hasMeaningfulVariation =
    bestDay && worstDay && Math.abs(bestDay.percentDiff - worstDay.percentDiff) > 5;

  if (entries.length < 7 || !hasMeaningfulVariation) {
    return null;
  }

  return (
    <Card className="p-4 rounded-2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{metricEmoji}</span>
          <h3 className="text-base font-semibold">Day of Week Patterns</h3>
        </div>

        {/* Insights summary */}
        <div className="space-y-2">
          {bestDay && bestDay.percentDiff > 5 && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>
                <span className="font-medium">{metricTitle}</span> is{" "}
                <span className="font-semibold text-green-600">
                  {Math.abs(bestDay.percentDiff).toFixed(0)}% higher
                </span>{" "}
                on <span className="font-medium">{bestDay.day}s</span>
              </span>
            </div>
          )}
          {worstDay && worstDay.percentDiff < -5 && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span>
                <span className="font-medium">{metricTitle}</span> is{" "}
                <span className="font-semibold text-red-600">
                  {Math.abs(worstDay.percentDiff).toFixed(0)}% lower
                </span>{" "}
                on <span className="font-medium">{worstDay.day}s</span>
              </span>
            </div>
          )}
        </div>

        {/* Day bars */}
        <div className="grid grid-cols-7 gap-1">
          {dayStats.stats.map((stat) => {
            const barHeight = stat.count > 0 ? Math.max((stat.average / 10) * 100, 10) : 0;
            const isBest = bestDay && stat.day === bestDay.day && stat.percentDiff > 5;
            const isWorst = worstDay && stat.day === worstDay.day && stat.percentDiff < -5;

            return (
              <div key={stat.day} className="flex flex-col items-center gap-1">
                <div className="h-16 w-full flex items-end justify-center">
                  {stat.count > 0 ? (
                    <div
                      className={`w-full rounded-t transition-all ${
                        isBest
                          ? "bg-green-500"
                          : isWorst
                          ? "bg-red-400"
                          : "bg-muted-foreground/30"
                      }`}
                      style={{ height: `${barHeight}%` }}
                      title={`${stat.day}: ${stat.average.toFixed(1)} avg (${stat.count} entries)`}
                    />
                  ) : (
                    <div
                      className="w-full h-1 bg-muted rounded"
                      title={`${stat.day}: No data`}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {stat.shortDay}
                </span>
                {stat.count > 0 && (
                  <span className="text-[9px] text-muted-foreground/70">
                    {stat.average.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Based on {entries.length} entries • Avg: {dayStats.overallAverage.toFixed(1)}
        </p>
      </div>
    </Card>
  );
};

export default DayOfWeekInsights;
