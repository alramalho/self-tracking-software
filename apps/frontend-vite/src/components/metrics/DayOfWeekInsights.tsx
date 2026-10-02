import { Card } from "@/components/ui/card";
import { useThemeColors } from "@/hooks/useThemeColors";
import { average } from "@/lib/metricFindings";
import { weekdayLine } from "@/lib/metricWords";
import { type MetricEntry } from "@tsw/prisma";
import React from "react";

const BAR_HEIGHT = 44;

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface DayOfWeekInsightsProps {
  // Rated check-ins for one metric.
  entries: MetricEntry[];
}

// One line and one shape: which weekdays stand apart. Shown only when a
// weekday with at least three check-ins differs from another by over 5%.
export const DayOfWeekInsights: React.FC<DayOfWeekInsightsProps> = ({
  entries,
}) => {
  const themeColors = useThemeColors();
  const overall = average(entries) ?? 0;
  const stats = DAYS_OF_WEEK.map((day, index) => {
    // A check-in is saved as its calendar date at UTC midnight.
    const rows = entries.filter(
      (entry) => new Date(entry.createdAt).getUTCDay() === index
    );
    const avg = average(rows) ?? 0;
    return {
      day,
      average: avg,
      count: rows.length,
      percent: overall ? ((avg - overall) / overall) * 100 : 0,
    };
  });
  const significant = stats
    .filter((stat) => stat.count >= 3)
    .sort((a, b) => a.percent - b.percent);
  const worst = significant[0];
  const best = significant[significant.length - 1];
  if (!best || !worst || best.percent - worst.percent <= 5) return null;
  // The days the sentence names stand out; the rest recede.
  const named = [
    ...(best.percent > 5 ? [best] : []),
    ...(worst.percent < -5 ? [worst] : []),
  ];

  return (
    <Card className="p-5 rounded-2xl space-y-3">
      <p className="text-[13px] text-muted-foreground">By weekday</p>
      <p className="text-[17px] font-semibold">
        {weekdayLine(
          best.percent > 5 ? best.day : undefined,
          worst.percent < -5 ? worst.day : undefined
        )}
      </p>
      <div className="flex gap-1">
        {stats.map((stat) => (
          <div key={stat.day} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full flex items-end"
              style={{ height: BAR_HEIGHT }}
            >
              <div
                className={`w-full rounded-[3px] ${themeColors.bg}`}
                style={{
                  height: stat.count ? (stat.average / 5) * BAR_HEIGHT : 2,
                  opacity: named.includes(stat) ? 1 : 0.3,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {stat.day.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DayOfWeekInsights;
