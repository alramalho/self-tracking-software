import { useTheme } from "@/contexts/theme/useTheme";
import { type MetricEntry } from "@tsw/prisma";
import HeatMap from "@uiw/react-heat-map";
import {
  format,
  startOfMonth,
  endOfMonth,
  differenceInWeeks,
  getMonth,
} from "date-fns";
import React from "react";

interface MiniMonthlyHeatmapProps {
  entries: MetricEntry[];
  year: number;
  month: number; // 0-indexed (0 = January)
}

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const getMetricColorMatrix = (isLightMode: boolean) => {
  if (isLightMode) {
    return [
      "#EBEDF0", // 0 - empty/no rating
      "#F87171", // 1 - low (red)
      "#FDBA74", // 2 - below average (orange)
      "#FDE047", // 3 - neutral (yellow)
      "#A3E635", // 4 - good (lime green)
      "#4ADE80", // 5 - best (green)
    ];
  }
  return [
    "#242424", // 0 - empty/no rating
    "#991B1B", // 1 - low (dark red)
    "#9A3412", // 2 - below average (dark orange)
    "#A16207", // 3 - neutral (dark yellow)
    "#4D7C0F", // 4 - good (dark lime)
    "#166534", // 5 - best (dark green)
  ];
};

const getColorForRating = (rating: number, isLightMode: boolean): string => {
  const colors = getMetricColorMatrix(isLightMode);
  const index = Math.min(Math.max(Math.round(rating), 0), 5);
  return colors[index] || colors[0];
};

export const MiniMonthlyHeatmap: React.FC<MiniMonthlyHeatmapProps> = ({
  entries,
  year,
  month,
}) => {
  const { isLightMode } = useTheme();

  // Calculate date range for this month
  const monthDate = new Date(year, month, 1);
  const startDate = startOfMonth(monthDate);
  const monthEndDate = endOfMonth(monthDate);

  // Filter entries for this month only
  const monthEntries = entries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    return getMonth(entryDate) === month && entryDate.getFullYear() === year;
  });

  // Build heatmap data - aggregate by date (average if multiple entries per day)
  const dateToRatings = new Map<string, number[]>();
  monthEntries.forEach((entry) => {
    const dateStr = format(new Date(entry.createdAt), "yyyy/MM/dd");
    if (!dateToRatings.has(dateStr)) {
      dateToRatings.set(dateStr, []);
    }
    dateToRatings.get(dateStr)!.push(entry.rating);
  });

  const heatmapData = Array.from(dateToRatings.entries()).map(
    ([date, ratings]) => ({
      date,
      count: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    })
  );

  // Calculate number of weeks in this month (typically 4-6)
  const numberOfWeeks = differenceInWeeks(monthEndDate, startDate) + 2;

  // Compact sizing for mini heatmap
  const rectSize = 10;
  const gap = 2;

  return (
    <div className="flex flex-col items-center">
      {/* Month label */}
      <span className="text-xs font-semibold text-muted-foreground mb-1">
        {MONTH_LABELS[month]}
      </span>

      {/* Mini heatmap */}
      <div className="flex justify-center">
        <HeatMap
          value={heatmapData}
          startDate={startDate}
          endDate={monthEndDate}
          width={(rectSize + gap) * numberOfWeeks + 10}
          height={(rectSize + gap) * 7 + 10}
          rectSize={rectSize}
          legendRender={() => <></>}
          rectProps={{
            rx: 2,
          }}
          weekLabels={false}
          monthLabels={false}
          rectRender={(props, data) => {
            const [y, m, d] = data.date.split("/").map(Number);
            const dateObj = new Date(Date.UTC(y, m - 1, d));

            // Only render cells for this month
            if (dateObj.getMonth() !== month) {
              return <rect {...(props as React.SVGProps<SVGRectElement>)} fill="transparent" />;
            }

            const hasData = data.count !== undefined && data.count > 0;
            const fillColor = hasData
              ? getColorForRating(data.count, isLightMode)
              : isLightMode
              ? "#EBEDF0"
              : "#242424";

            return (
              <rect
                {...(props as React.SVGProps<SVGRectElement>)}
                fill={fillColor}
                rx={2}
              />
            );
          }}
        />
      </div>
    </div>
  );
};

export default MiniMonthlyHeatmap;
