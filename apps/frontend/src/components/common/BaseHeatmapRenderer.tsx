import { useActivities } from "@/contexts/activities";
import { Activity } from "@tsw/prisma";
import HeatMap from "@uiw/react-heat-map";
import { format } from "date-fns";
import { Brush } from "lucide-react";
import React, { useState } from "react";

export interface HeatmapData {
  date: string;
  count: number;
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
}

export const getActivityColorMatrix = () => {
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
  return baseColors;
};

// Helper function to convert HEX to RGBA
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const intensityAlphaLevels = [0.2, 0.4, 0.6, 0.8, 1.0]; // Define alpha levels for intensities 0-4

export const getActivityColor = (
  activityIndex: number,
  intensityLevel: number,
  activity?: Activity
) => {
  if (activity?.colorHex) {
    // Ensure intensityLevel is within the bounds of our alpha levels array
    const alpha =
      intensityAlphaLevels[
        Math.min(intensityLevel, intensityAlphaLevels.length - 1)
      ];
    return hexToRgba(activity.colorHex, alpha);
  }
  const colorMatrix = getActivityColorMatrix();
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
}) => {
  // Add state for selected date
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Convert dates to UTC
  const utcStartDate = new Date(
    Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  );
  const utcEndDate = endDate
    ? new Date(
        Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      )
    : undefined;
  const { activities: userActivities } = useActivities();

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
  const renderActivityLegend = () => {
    const colorMatrix = getActivityColorMatrix();
    return (
      <div className="grid grid-cols-[auto_1fr] gap-3 mt-2">
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

        {!noActivityLegend &&
          activities.map((activity, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-row gap-0 items-center">
                {activity.colorHex
                  ? intensityAlphaLevels.map((alpha, intensityIdx) => (
                      <div
                        key={intensityIdx}
                        className="w-4 h-4"
                        style={{
                          backgroundColor: hexToRgba(activity.colorHex!, alpha),
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
                      className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                      title={`Edit ${activity.title}`}
                    >
                      <Brush size={16} />
                    </button>
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  ({activity.measure})
                </span>
              </div>
            </React.Fragment>
          ))}
      </div>
    );
  };

  return (
    <div className="mb-4 grid gap-5">
      <div className="overflow-x-auto">
        <div className="relative mt-2">
          <HeatMap
            value={heatmapData}
            startDate={utcStartDate}
            endDate={utcEndDate}
            width={45 + 26 * numberOfWeeks}
            height={220}
            rectSize={20}
            legendRender={() => <></>}
            rectProps={{
              rx: 4,
            }}
            rectRender={(props, data) => {
              // Convert date string to UTC Date object
              const [year, month, day] = data.date.split("/").map(Number);
              const dateObj = new Date(Date.UTC(year, month - 1, day));

              const dateStrForIntensity = format(dateObj, "yyyy-MM-dd");
              const intensities = getIntensityForDate(dateStrForIntensity);

              // Compare UTC dates for today check
              const today = new Date();
              const todayUTC = new Date(
                Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
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

              const renderRects = () => {
                if (!intensities || intensities.length === 0) {
                  const rects = [];
                  rects.push(
                    <rect
                      key={data.index}
                      {...props}
                      fill="#EBEDF0"
                      stroke={isCurrentDay ? "#FF0000" : "none"}
                      strokeWidth={isCurrentDay ? 2 : 0}
                      rx={4}
                    />
                  );

                  // Add today's border if needed
                  if (isCurrentDay) {
                    rects.push(
                      <rect
                        key="today-border"
                        {...props}
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
                        {...props}
                        fill="none"
                        stroke="#0066FF"
                        strokeWidth={2}
                        rx={4}
                      />
                    );
                  }

                  return <g>{rects}</g>;
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
                      {...props}
                      fill={getActivityColor(
                        intensities[0].activityIndex,
                        intensities[0].intensity,
                        activity
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
                        activity1
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
                        activity2
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
                        activity1
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
                        activity2
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
                        activity3
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
                        activity1
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
                        activity2
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
                        activity3
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
                        activity4
                      )}
                    />
                  );
                }

                // Add today's border if needed
                if (isCurrentDay) {
                  rects.push(
                    <rect
                      key="today-border"
                      {...props}
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
                      {...props}
                      fill="none"
                      stroke="#0066FF"
                      strokeWidth={2}
                      rx={4}
                    />
                  );
                }

                return <g>{rects}</g>;
              };

              return (
                <g
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
      <div className="flex justify-center">{renderActivityLegend()}</div>
    </div>
  );
};

export default BaseHeatmapRenderer;
