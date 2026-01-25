import { useTheme } from "@/contexts/theme/useTheme";
import { type MetricEntry } from "@tsw/prisma";
import HeatMap from "@uiw/react-heat-map";
import { format, differenceInWeeks } from "date-fns";
import { ChevronRight } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface MetricHeatmapProps {
  entries: MetricEntry[];
  metricEmoji?: string;
  metricTitle?: string;
}

// Colors for metric intensity (0-5 rating scale)
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
  // Map rating 0-5 to color index 0-5
  const index = Math.min(Math.max(Math.round(rating), 0), 5);
  return colors[index] || colors[0];
};

export const MetricHeatmap: React.FC<MetricHeatmapProps> = ({
  entries,
  metricEmoji,
  metricTitle,
}) => {
  const { isLightMode } = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isTodayVisible, setIsTodayVisible] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get the earliest entry date as start date
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const firstEntry = sortedEntries[0];
  const startDate = firstEntry
    ? new Date(
        Date.UTC(
          new Date(firstEntry.createdAt).getFullYear(),
          new Date(firstEntry.createdAt).getMonth(),
          new Date(firstEntry.createdAt).getDate()
        )
      )
    : new Date();

  const today = new Date();
  const endDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  // Calculate number of weeks
  const numberOfWeeks = Math.max(differenceInWeeks(endDate, startDate) + 2, 8);

  // Build heatmap data - aggregate by date (average if multiple entries per day)
  const dateToRatings = new Map<string, number[]>();
  entries.forEach((entry) => {
    const dateStr = format(new Date(entry.createdAt), "yyyy/MM/dd");
    if (!dateToRatings.has(dateStr)) {
      dateToRatings.set(dateStr, []);
    }
    dateToRatings.get(dateStr)!.push(entry.rating);
  });

  const heatmapData = Array.from(dateToRatings.entries()).map(
    ([date, ratings]) => ({
      date,
      count: ratings.reduce((a, b) => a + b, 0) / ratings.length, // average
    })
  );

  // Intersection Observer to detect when today's cell is visible
  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const timeoutId = setTimeout(() => {
      const todayCell = document.getElementById("metric-heatmap-today-cell");
      if (!todayCell || !scrollContainerRef.current) return;

      observer = new IntersectionObserver(
        ([entry]) => {
          setIsTodayVisible(entry.isIntersecting);
        },
        {
          root: scrollContainerRef.current,
          threshold: 0.1,
        }
      );

      observer.observe(todayCell);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [heatmapData.length]);

  const scrollToToday = () => {
    const todayCell = document.getElementById("metric-heatmap-today-cell");
    if (todayCell) {
      todayCell.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get entries for the selected date
  const getEntriesForSelectedDate = () => {
    if (!selectedDate) return [];
    const selectedDateStr = format(selectedDate, "yyyy/MM/dd");
    return entries.filter(
      (entry) => format(new Date(entry.createdAt), "yyyy/MM/dd") === selectedDateStr
    );
  };

  const renderSelectedDateViewer = () => {
    if (!selectedDate) return null;

    const entriesOnDate = getEntriesForSelectedDate();
    const avgRating = entriesOnDate.length > 0
      ? entriesOnDate.reduce((sum, e) => sum + e.rating, 0) / entriesOnDate.length
      : null;

    return (
      <div className="p-4 bg-muted/70 backdrop-blur-sm rounded-xl w-full max-w-md mb-4">
        <h3 className="text-md font-semibold mb-2 text-left">
          {metricEmoji} {metricTitle ? `${metricTitle} on ` : ""}{format(selectedDate, "MMMM d, yyyy")}
        </h3>
        {entriesOnDate.length === 0 ? (
          <p className="text-left text-sm text-muted-foreground">
            No rating recorded for this date.
          </p>
        ) : (
          <div className="text-left">
            <p className="text-2xl font-bold">
              {avgRating !== null ? avgRating.toFixed(1) : "-"} <span className="text-sm font-normal text-muted-foreground">/ 5</span>
            </p>
            {entriesOnDate.length > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Average of {entriesOnDate.length} entries
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-4 grid gap-3 -mx-4">
      {/* Selected date viewer */}
      <div className="flex justify-center px-4">
        {renderSelectedDateViewer()}
      </div>

      <div className="relative flex max-w-full overflow-x-scroll">
        {/* Fixed weekday labels */}
        <div className="sticky left-0 z-20 flex flex-col gap-[6px] pt-[30px] pr-2 pl-4 ml-0">
          {weekdays.map((day) => (
            <div
              key={day}
              className="text-[10px] text-foreground h-[16px] flex items-center"
              style={{ width: "30px" }}
            >
              {day}
            </div>
          ))}
        </div>

        <div
          className="flex-1 max-w-full flex flex-row justify-center items-center overflow-x-scroll"
          ref={scrollContainerRef}
        >
          <div className="relative mt-2 max-w-full">
            <HeatMap
              value={heatmapData}
              startDate={startDate}
              endDate={endDate}
              width={26 * numberOfWeeks}
              height={220}
              rectSize={20}
              legendRender={() => <></>}
              rectProps={{
                rx: 4,
              }}
              weekLabels={false}
              rectRender={(props, data) => {
                const [year, month, day] = data.date.split("/").map(Number);
                const dateObj = new Date(Date.UTC(year, month - 1, day));

                // Check if today
                const todayUTC = new Date(
                  Date.UTC(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  )
                );
                const isCurrentDay = dateObj.getTime() === todayUTC.getTime();
                const todayCellId = isCurrentDay
                  ? "metric-heatmap-today-cell"
                  : undefined;

                // Check if selected
                const isSelected = selectedDate &&
                  dateObj.getTime() === new Date(
                    Date.UTC(
                      selectedDate.getFullYear(),
                      selectedDate.getMonth(),
                      selectedDate.getDate()
                    )
                  ).getTime();

                // Get color based on rating (data.count is the average rating)
                const hasData = data.count !== undefined && data.count > 0;
                const fillColor = hasData
                  ? getColorForRating(data.count, isLightMode)
                  : isLightMode
                  ? "#EBEDF0"
                  : "#242424";

                return (
                  <g
                    id={todayCellId}
                    onClick={() => {
                      if (!isNaN(dateObj.getTime())) {
                        setSelectedDate(dateObj);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      {...(props as React.SVGProps<SVGRectElement>)}
                      fill={fillColor}
                      rx={4}
                    />
                    {isCurrentDay && (
                      <rect
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill="none"
                        stroke="#FF0000"
                        strokeWidth={2}
                        rx={4}
                      />
                    )}
                    {isSelected && (
                      <rect
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill="none"
                        stroke="#0066FF"
                        strokeWidth={2}
                        rx={4}
                      />
                    )}
                  </g>
                );
              }}
            />
          </div>
        </div>

        {/* Floating arrow button to scroll to today */}
        <AnimatePresence>
          {!isTodayVisible && (
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onClick={scrollToToday}
              className="sticky right-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-8 h-8 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/90 transition-colors border border-border dark:border-primary/20"
              title="Scroll to today"
            >
              <ChevronRight size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground px-4">
        <span>Low</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((rating) => (
            <div
              key={rating}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getColorForRating(rating, isLightMode) }}
            />
          ))}
        </div>
        <span>High</span>
        {metricEmoji && <span className="ml-2">{metricEmoji}</span>}
      </div>
    </div>
  );
};

export default MetricHeatmap;
