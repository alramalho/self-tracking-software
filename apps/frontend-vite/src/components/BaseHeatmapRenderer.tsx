/* eslint-disable react-refresh/only-export-components */

import { useActivities } from "@/contexts/activities/useActivities";
import { useTheme } from "@/contexts/theme/useTheme";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { type Activity } from "@tsw/prisma";
import HeatMap from "@uiw/react-heat-map";
import { format, subDays, differenceInDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Brush, ChevronDown, ChevronRight, Lock } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";

export interface HeatmapData {
  date: string;
  count: number;
}

export interface PauseHistoryEntry {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
}

export interface BaseHeatmapRendererProps {
  activities: Activity[];
  startDate: Date;
  endDate?: Date;
  heatmapData: HeatmapData[];
  onDateClick: (date: Date) => void;
  getIntensityForDate: (
    date: string
  ) => { activityIndex: number; intensity: number }[] | null;
  noActivityLegend?: boolean;
  getWeekCompletionStatus?: (weekStartDate: Date) => boolean;
  onEditActivity?: (activity: Activity) => void;
  refreshKey?: number | string;
  uniqueId?: string;
  bgClassName?: string;
  pauseHistory?: PauseHistoryEntry[] | null;
}

export const getActivityColorMatrix = (isLightMode: boolean = true) => {
  const baseColors = [
    ["#9AE6B4", "#68D391", "#48BB78", "#38A169", "#2F855A"], // green
    ["#BEE3F8", "#90CDF4", "#63B3ED", "#4299E1", "#3182CE"], // blue
    ["#FEB2B2", "#FC8181", "#F56565", "#E53E3E", "#C53030"], // red
    ["#FAF089", "#F6E05E", "#ECC94B", "#D69E2E", "#B7791F"], // yellow
    ["#E9D8FD", "#D6BCFA", "#B794F4", "#9F7AEA", "#805AD5"], // purple
    ["#FED7E2", "#FBB6CE", "#F687B3", "#ED64A6", "#D53F8C"], // pink
    ["#C3DAFE", "#A3BFFA", "#7F9CF5", "#667EEA", "#5A67D8"], // indigo
    ["#E2E8F0", "#CBD5E0", "#A0AEC0", "#718096", "#4A5568"], // gray
  ];
  const darkBaseColors = [
    ["#065F46", "#047857", "#059669", "#10B981", "#34D399"], // green - darker to lighter
    ["#075985", "#0369A1", "#0284C7", "#0EA5E9", "#38BDF8"], // blue - darker to lighter
    ["#991B1B", "#B91C1C", "#DC2626", "#EF4444", "#F87171"], // red - darker to lighter
    ["#854D0E", "#A16207", "#CA8A04", "#EAB308", "#FACC15"], // yellow - darker to lighter
    ["#5B21B6", "#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA"], // purple - darker to lighter
    ["#9F1239", "#BE185D", "#DB2777", "#EC4899", "#F472B6"], // pink - darker to lighter
    ["#3730A3", "#4338CA", "#4F46E5", "#6366F1", "#818CF8"], // indigo - darker to lighter
    ["#1E293B", "#334155", "#475569", "#64748B", "#94A3B8"], // gray - darker to lighter
  ];
  return isLightMode ? baseColors : darkBaseColors;
};

// Helper function to convert HEX to RGBA
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const intensityAlphaLevels = [0.4, 0.55, 0.7, 0.85, 1.0]; // Define alpha levels for intensities 0-4

export const getActivityColor = (
  activityIndex: number,
  intensityLevel: number,
  activity?: Activity,
  isLightMode: boolean = true
) => {
  if (activity?.colorHex) {
    // Ensure intensityLevel is within the bounds of our alpha levels array
    const alpha =
      intensityAlphaLevels[
        Math.min(intensityLevel, intensityAlphaLevels.length - 1)
      ];
    return hexToRgba(activity.colorHex, alpha);
  }
  const colorMatrix = getActivityColorMatrix(isLightMode);
  const row = colorMatrix[activityIndex % colorMatrix.length];
  return row[Math.min(intensityLevel, row.length - 1)];
};

const BaseHeatmapRenderer: React.FC<BaseHeatmapRendererProps> = ({
  activities,
  startDate,
  endDate,
  heatmapData,
  onDateClick,
  getIntensityForDate,
  noActivityLegend = false,
  getWeekCompletionStatus,
  onEditActivity,
  uniqueId,
  pauseHistory,
}) => {
  const { isLightMode } = useTheme();
  const { isUserPremium } = usePaidPlan();
  const navigate = useNavigate();

  // Helper to check if a date falls within any pause period
  const isDatePaused = (dateObj: Date): boolean => {
    if (!pauseHistory || pauseHistory.length === 0) return false;

    const dateTime = dateObj.getTime();
    return pauseHistory.some((pause) => {
      const pausedAt = new Date(pause.pausedAt).getTime();
      const resumedAt = pause.resumedAt ? new Date(pause.resumedAt).getTime() : Date.now();
      return dateTime >= pausedAt && dateTime <= resumedAt;
    });
  };

  // Add state for selected date
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Add state for legend expansion
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  // Add ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Add ref for the card container
  const cardContainerRef = useRef<HTMLDivElement>(null);
  // Track if today's cell is visible using Intersection Observer
  const [isTodayVisible, setIsTodayVisible] = useState(true);

  // Convert dates to UTC
  const originalUtcStartDate = new Date(
    Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  );
  const utcEndDate = endDate
    ? new Date(
        Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      )
    : undefined;

  // For free users, limit to 180 days of history
  const FREE_USER_DAYS_LIMIT = 180;
  const today = new Date();
  const daysFromStart = differenceInDays(today, originalUtcStartDate);
  const isHistoryLimited =
    !isUserPremium && daysFromStart > FREE_USER_DAYS_LIMIT;

  const utcStartDate = isHistoryLimited
    ? new Date(
        Date.UTC(
          ...(subDays(today, FREE_USER_DAYS_LIMIT)
            .toISOString()
            .split("T")[0]
            .split("-")
            .map((n, i) => (i === 1 ? parseInt(n) - 1 : parseInt(n))) as [
            number,
            number,
            number
          ])
        )
      )
    : originalUtcStartDate;
  const { activities: userActivities } = useActivities();
  const {setShowUpgradePopover} = useUpgrade();

  const isOwnActivity = (activity: Activity) => {
    return userActivities?.some(
      (userActivity) => userActivity.id === activity.id
    );
  };

  const numberOfWeeks = utcEndDate
    ? Math.ceil(
        (utcEndDate.getTime() - utcStartDate.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    : 52;

  // Scroll to the right (today) on mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Use Intersection Observer to detect when today's cell is visible
  useEffect(() => {
    const cellId = uniqueId
      ? `heatmap-today-cell-${uniqueId}`
      : "heatmap-today-cell";

    let observer: IntersectionObserver | null = null;

    // Wait for heatmap to render
    const timeoutId = setTimeout(() => {
      const todayCell = document.getElementById(cellId);
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
  }, [heatmapData.length, uniqueId]);

  // Scroll to today's cell when user clicks the arrow button
  const scrollToToday = () => {
    const cellId = uniqueId
      ? `heatmap-today-cell-${uniqueId}`
      : "heatmap-today-cell";
    const todayCell = document.getElementById(cellId);
    if (todayCell) {
      todayCell.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };
  const renderActivityLegend = () => {
    const colorMatrix = getActivityColorMatrix(isLightMode);
    return (
      <div className="grid grid-cols-[auto_1fr] gap-3 mt-2 w-full px-4">
        <button
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className="col-span-2 w-full flex items-center gap-2 text-lg font-semibold hover:text-muted-foreground transition-colors py-1"
        >
          <ChevronDown
            size={25}
            className={`transition-transform ${
              isLegendExpanded ? "rotate-180" : ""
            }`}
          />
          Legend
        </button>

        <AnimatePresence>
          {isLegendExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="col-span-2 grid grid-cols-[auto_1fr] gap-3 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4"
                  style={{
                    border: "2px solid #FF0000",
                  }}
                  title="Today's date"
                />
                <div
                  className="w-4 h-4"
                  style={{
                    border: "2px solid #0066FF",
                  }}
                  title="Selected date"
                />
              </div>
              <span className="text-sm font-semibold">Today / Selected</span>

              {pauseHistory && pauseHistory.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4"
                      style={{
                        backgroundColor: isLightMode ? "#FEF3C7" : "#422006",
                        border: `1.5px dashed ${isLightMode ? "#F59E0B" : "#FBBF24"}`,
                        borderRadius: "2px",
                      }}
                      title="Paused date"
                    />
                  </div>
                  <span className="text-sm font-semibold">Paused</span>
                </>
              )}

              {!noActivityLegend &&
                activities?.map((activity, index) => (
                  <React.Fragment key={index}>
                    <div className="flex flex-row gap-0 items-center">
                      {activity.colorHex
                        ? intensityAlphaLevels.map((alpha, intensityIdx) => (
                            <div
                              key={intensityIdx}
                              className="w-4 h-4"
                              style={{
                                backgroundColor: hexToRgba(
                                  activity.colorHex!,
                                  alpha
                                ),
                              }}
                              title={`${activity.title} - Intensity ${
                                intensityIdx + 1
                              }`}
                            />
                          ))
                        : colorMatrix[index % colorMatrix.length].map(
                            (color, intensityIndex) => (
                              <div
                                key={intensityIndex}
                                className="w-4 h-4"
                                style={{ backgroundColor: color }}
                                title={`Intensity level ${intensityIndex + 1}`}
                              />
                            )
                          )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold flex items-center">
                        {activity.emoji} {activity.title}
                        {onEditActivity && isOwnActivity(activity) && (
                          <button
                            onClick={() => onEditActivity(activity)}
                            className="ml-2 p-1 text-muted-foreground hover:text-foreground"
                            title={`Edit ${activity.title}`}
                          >
                            <Brush size={16} />
                          </button>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({activity.measure})
                      </span>
                    </div>
                  </React.Fragment>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleLockerClick = () => {
    setShowUpgradePopover(true);
  };

  return (
    <div ref={cardContainerRef} className="mb-4 grid gap-3 -mx-4">
      <div className="relative flex max-w-full overflow-x-scroll">
        {/* Fixed weekday labels - outside scroll container */}
        <div
          className={`sticky left-0 z-20 flex flex-col gap-[6px] pt-[30px] pr-2 pl-4 ml-0`}
        >
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

        {/* Locker for limited history - sticky on left */}

        <div className={`flex-1 max-w-full flex flex-row justify-center items-center overflow-x-scroll`} ref={scrollContainerRef}>
          {isHistoryLimited && (
            <div
              className="flex flex-col self-center justify-center w-16 bg-gradient-to-r from-card via-card/80 to-transparent cursor-pointer hover:from-muted transition-colors pb-5 px-4 ml-3"
              onClick={handleLockerClick}
              title="Upgrade to view full history"
            >
              <Lock className="w-5 h-5 text-muted-foreground ml-2" />
            </div>
          )}
          <div className="relative mt-2 max-w-full">
            <HeatMap
              value={heatmapData}
              startDate={utcStartDate}
              endDate={utcEndDate}
              width={26 * numberOfWeeks}
              height={220}
              rectSize={20}
              legendRender={() => <></>}
              rectProps={{
                rx: 4,
              }}
              weekLabels={false}
              rectRender={(props, data) => {
                // Convert date string to UTC Date object
                const [year, month, day] = data.date.split("/").map(Number);
                const dateObj = new Date(Date.UTC(year, month - 1, day));

                const dateStrForIntensity = format(dateObj, "yyyy-MM-dd");
                const intensities = getIntensityForDate(dateStrForIntensity);

                // Compare UTC dates for today check
                const today = new Date();
                const todayUTC = new Date(
                  Date.UTC(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  )
                );
                const isCurrentDay = dateObj.getTime() === todayUTC.getTime();

                // Check if this date is selected
                const isSelectedDate =
                  selectedDate &&
                  (() => {
                    const selectedUTC = new Date(
                      Date.UTC(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate()
                      )
                    );
                    return dateObj.getTime() === selectedUTC.getTime();
                  })();

                // Check if this date falls within a pause period
                const isPausedDate = isDatePaused(dateObj);

                // note to self:
                // we were refactoring plan prgoress, right now its scatteres throughout the frontend,
                // making it hard to iterate, and prone to bugs
                // we must centralize as we are doing in SimplifiedPlanProgressContext
                // like here below, we'd just change the getWeekCompeltionStatus for something that get's current week based
                // on data and then .isCompleted (where each week has startDate, endDate, and isCompleted)

                // Check if this is the last day of the week (Saturday)
                const isLastDayOfWeek = dateObj.getUTCDay() === 6;

                // If it's Saturday and we have the completion check function, check if the week is completed
                // We need to get the start of this week (Sunday) to check completion
                const isWeekCompleted =
                  isLastDayOfWeek &&
                  getWeekCompletionStatus &&
                  (() => {
                    const weekStart = new Date(dateObj);
                    weekStart.setUTCDate(weekStart.getUTCDate() - 6); // Go back 6 days to get to Sunday
                    return getWeekCompletionStatus(weekStart);
                  })();

                const todayCellId = isCurrentDay
                  ? uniqueId
                    ? `heatmap-today-cell-${uniqueId}`
                    : "heatmap-today-cell"
                  : undefined;

                const renderRects = () => {
                  // Paused date styling colors
                  const pausedFill = isLightMode ? "#FEF3C7" : "#422006"; // Yellow-100 / Yellow-900
                  const pausedStroke = isLightMode ? "#F59E0B" : "#FBBF24"; // Amber-500 / Amber-400

                  if (!intensities || intensities.length === 0) {
                    const rects = [];
                    rects.push(
                      <rect
                        key={data.index}
                        id={todayCellId}
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill={isPausedDate ? pausedFill : (isLightMode ? "#EBEDF0" : "#242424")}
                        stroke={isCurrentDay ? "#FF0000" : "none"}
                        strokeWidth={isCurrentDay ? 2 : 0}
                        rx={4}
                        opacity={isPausedDate ? 0.7 : 1}
                      />
                    );

                    // Add paused indicator (dashed border)
                    if (isPausedDate) {
                      rects.push(
                        <rect
                          key="paused-border"
                          {...(props as React.SVGProps<SVGRectElement>)}
                          fill="none"
                          stroke={pausedStroke}
                          strokeWidth={1.5}
                          strokeDasharray="3,2"
                          rx={4}
                        />
                      );
                    }

                    // Add today's border if needed
                    if (isCurrentDay) {
                      rects.push(
                        <rect
                          key="today-border"
                          {...(props as React.SVGProps<SVGRectElement>)}
                          fill="none"
                          stroke="#FF0000"
                          strokeWidth={2}
                          rx={4}
                        />
                      );
                    }

                    // Add selected date border if needed
                    if (isSelectedDate) {
                      rects.push(
                        <rect
                          key="selected-border"
                          {...(props as React.SVGProps<SVGRectElement>)}
                          fill="none"
                          stroke="#0066FF"
                          strokeWidth={2}
                          rx={4}
                        />
                      );
                    }

                    return <g id={todayCellId}>{rects}</g>;
                  }

                  const rects = [];
                  const rectWidth = Number(props.width) || 0;
                  const rectHeight = Number(props.height) || 0;
                  const baseX = Number(props.x) || 0;
                  const baseY = Number(props.y) || 0;
                  const gap = 1; // Gap between rectangles

                  if (intensities.length === 1) {
                    const activity = activities[intensities[0].activityIndex];
                    rects.push(
                      <rect
                        key={0}
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill={getActivityColor(
                          intensities[0].activityIndex,
                          intensities[0].intensity,
                          activity,
                          isLightMode
                        )}
                        rx={4}
                      />
                    );
                  } else if (intensities.length === 2) {
                    const halfWidth = (rectWidth - gap) / 2;
                    const activity1 = activities[intensities[0].activityIndex];
                    const activity2 = activities[intensities[1].activityIndex];
                    rects.push(
                      <path
                        key={0}
                        d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${
                          baseY + rectHeight - 4
                        }
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                        fill={getActivityColor(
                          intensities[0].activityIndex,
                          intensities[0].intensity,
                          activity1,
                          isLightMode
                        )}
                      />,
                      <path
                        key={1}
                        d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${
                          baseY + 4
                        }
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${
                          baseX + rectWidth - 4
                        } ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                        fill={getActivityColor(
                          intensities[1].activityIndex,
                          intensities[1].intensity,
                          activity2,
                          isLightMode
                        )}
                      />
                    );
                  } else if (intensities.length === 3) {
                    const halfWidth = (rectWidth - gap) / 2;
                    const halfHeight = (rectHeight - gap) / 2;
                    const activity1 = activities[intensities[0].activityIndex];
                    const activity2 = activities[intensities[1].activityIndex];
                    const activity3 = activities[intensities[2].activityIndex];
                    rects.push(
                      <path
                        key={0}
                        d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + halfHeight}
                         L ${baseX} ${baseY + halfHeight}
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                        fill={getActivityColor(
                          intensities[0].activityIndex,
                          intensities[0].intensity,
                          activity1,
                          isLightMode
                        )}
                      />,
                      <path
                        key={1}
                        d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${
                          baseY + 4
                        }
                         L ${baseX + rectWidth} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                        fill={getActivityColor(
                          intensities[1].activityIndex,
                          intensities[1].intensity,
                          activity2,
                          isLightMode
                        )}
                      />,
                      <path
                        key={2}
                        d={`M ${baseX} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${
                          baseX + rectWidth - 4
                        } ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${
                          baseY + rectHeight - 4
                        }
                         L ${baseX} ${baseY + halfHeight + gap}`}
                        fill={getActivityColor(
                          intensities[2].activityIndex,
                          intensities[2].intensity,
                          activity3,
                          isLightMode
                        )}
                      />
                    );
                  } else if (intensities.length >= 4) {
                    const halfWidth = (rectWidth - gap) / 2;
                    const halfHeight = (rectHeight - gap) / 2;
                    const activity1 = activities[intensities[0].activityIndex];
                    const activity2 = activities[intensities[1].activityIndex];
                    const activity3 = activities[intensities[2].activityIndex];
                    const activity4 = activities[intensities[3].activityIndex];
                    rects.push(
                      <path
                        key={0}
                        d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + halfHeight}
                         L ${baseX} ${baseY + halfHeight}
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                        fill={getActivityColor(
                          intensities[0].activityIndex,
                          intensities[0].intensity,
                          activity1,
                          isLightMode
                        )}
                      />,
                      <path
                        key={1}
                        d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${
                          baseY + 4
                        }
                         L ${baseX + rectWidth} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                        fill={getActivityColor(
                          intensities[1].activityIndex,
                          intensities[1].intensity,
                          activity2,
                          isLightMode
                        )}
                      />,
                      <path
                        key={2}
                        d={`M ${baseX} ${baseY + halfHeight + gap}
                         L ${baseX + halfWidth} ${baseY + halfHeight + gap}
                         L ${baseX + halfWidth} ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${
                          baseY + rectHeight - 4
                        }
                         L ${baseX} ${baseY + halfHeight + gap}`}
                        fill={getActivityColor(
                          intensities[2].activityIndex,
                          intensities[2].intensity,
                          activity3,
                          isLightMode
                        )}
                      />,
                      <path
                        key={3}
                        d={`M ${baseX + halfWidth + gap} ${
                          baseY + halfHeight + gap
                        }
                         L ${baseX + rectWidth} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${
                          baseX + rectWidth - 4
                        } ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${
                          baseY + halfHeight + gap
                        }`}
                        fill={getActivityColor(
                          intensities[3].activityIndex,
                          intensities[3].intensity,
                          activity4,
                          isLightMode
                        )}
                      />
                    );
                  }

                  // Add today's border if needed
                  if (isCurrentDay) {
                    rects.push(
                      <rect
                        key="today-border"
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill="none"
                        stroke="#FF0000"
                        strokeWidth={2}
                        rx={4}
                      />
                    );
                  }

                  // Add selected date border if needed
                  if (isSelectedDate) {
                    rects.push(
                      <rect
                        key="selected-border"
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill="none"
                        stroke="#0066FF"
                        strokeWidth={2}
                        rx={4}
                      />
                    );
                  }

                  // Add paused overlay (semi-transparent with dashed border)
                  if (isPausedDate) {
                    rects.push(
                      <rect
                        key="paused-overlay"
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill={pausedFill}
                        opacity={0.5}
                        rx={4}
                      />,
                      <rect
                        key="paused-border"
                        {...(props as React.SVGProps<SVGRectElement>)}
                        fill="none"
                        stroke={pausedStroke}
                        strokeWidth={1.5}
                        strokeDasharray="3,2"
                        rx={4}
                      />
                    );
                  }

                  return <g>{rects}</g>;
                };

                return (
                  <g
                    id={todayCellId}
                    onClick={() => {
                      if (!isNaN(dateObj.getTime())) {
                        setSelectedDate(dateObj);
                        onDateClick(dateObj);
                      }
                    }}
                  >
                    {renderRects()}
                    {isLastDayOfWeek && isWeekCompleted && (
                      <text
                        x={Number(props.x) + 10}
                        y={Number(props.y) + 40}
                        className="select-none text-xl"
                        textAnchor="middle"
                      >
                        🔥
                      </text>
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
      <div className="flex justify-center mx-4">{renderActivityLegend()}</div>
    </div>
  );
};

export default BaseHeatmapRenderer;
