import React, { useState } from "react";
import { format, addDays, isToday, subMonths } from "date-fns";
import HeatMap from "@uiw/react-heat-map";
import { Activity } from "@/contexts/UserPlanContext";

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

export const getActivityColor = (
  activityIndex: number,
  intensityLevel: number
) => {
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
  noActivityLegend = false
}) => {
  // Convert dates to UTC
  const utcStartDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
  const utcEndDate = endDate ? new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())) : undefined;

  const numberOfWeeks = utcEndDate
    ? Math.ceil(
        (utcEndDate.getTime() - utcStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
    : 52;
  const renderActivityLegend = () => {
    const colorMatrix = getActivityColorMatrix();
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 mt-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4"
            style={{
              border: "2px solid #FF0000",
            }}
            title="Today's date"
          />
        </div>
        <span className="text-sm font-semibold">Today</span>
        
        {!noActivityLegend && activities.map((activity, index) => (
          <React.Fragment key={index}>
            <div className="flex flex-row gap-0 items-center">
              {colorMatrix[index % colorMatrix.length].map(
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
              <span className="text-sm font-semibold mb-1">
                {activity.emoji} {activity.title}
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
    <div className="mb-4 grid gap-4">
      <div className="overflow-x-auto">
        <div className="relative">
          <HeatMap
            value={heatmapData}
            startDate={utcStartDate}
            endDate={utcEndDate}
            width={45 + 26 * numberOfWeeks}
            height={215}
            rectSize={20}
            legendRender={() => <React.Fragment key={crypto.randomUUID()} />}
            rectProps={{
              rx: 4,
            }}
            rectRender={(props, data) => {
              // Convert date string to UTC Date object
              const [year, month, day] = data.date.split('/').map(Number);
              const dateObj = new Date(Date.UTC(year, month - 1, day));
              
              const intensities = getIntensityForDate(
                format(dateObj, "yyyy-MM-dd")
              );

              // Compare UTC dates for today check
              const today = new Date();
              const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
              const isCurrentDay = dateObj.getTime() === todayUTC.getTime();
              
              const renderRects = () => {
                if (!intensities || intensities.length === 0) {
                  return (
                    <rect
                      key={data.index}
                      {...props}
                      fill="#EBEDF0"
                      stroke={isCurrentDay ? "#FF0000" : "none"}
                      strokeWidth={isCurrentDay ? 2 : 0}
                      rx={4}
                    />
                  );
                }

                const rects = [];
                const rectWidth = Number(props.width) || 0;
                const rectHeight = Number(props.height) || 0;
                const baseX = Number(props.x) || 0;
                const baseY = Number(props.y) || 0;
                const gap = 1; // Gap between rectangles

                if (intensities.length === 1) {
                  // Single full-size rectangle
                  rects.push(
                    <rect
                      key={0}
                      {...props}
                      fill={getActivityColor(intensities[0].activityIndex, intensities[0].intensity)}
                      rx={4}
                    />
                  );
                } else if (intensities.length === 2) {
                  // Two vertical rectangles
                  const halfWidth = (rectWidth - gap) / 2;
                  rects.push(
                    <path
                      key={0}
                      d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${baseY + rectHeight - 4}
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                      fill={getActivityColor(intensities[0].activityIndex, intensities[0].intensity)}
                    />,
                    <path
                      key={1}
                      d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${baseY + 4}
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${baseX + rectWidth - 4} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                      fill={getActivityColor(intensities[1].activityIndex, intensities[1].intensity)}
                    />
                  );
                } else if (intensities.length === 3) {
                  // Two rectangles on top, one on bottom
                  const halfWidth = (rectWidth - gap) / 2;
                  const halfHeight = (rectHeight - gap) / 2;
                  rects.push(
                    <path
                      key={0}
                      d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + halfHeight}
                         L ${baseX} ${baseY + halfHeight}
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                      fill={getActivityColor(intensities[0].activityIndex, intensities[0].intensity)}
                    />,
                    <path
                      key={1}
                      d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${baseY + 4}
                         L ${baseX + rectWidth} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                      fill={getActivityColor(intensities[1].activityIndex, intensities[1].intensity)}
                    />,
                    <path
                      key={2}
                      d={`M ${baseX} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${baseX + rectWidth - 4} ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${baseY + rectHeight - 4}
                         L ${baseX} ${baseY + halfHeight + gap}`}
                      fill={getActivityColor(intensities[2].activityIndex, intensities[2].intensity)}
                    />
                  );
                } else if (intensities.length >= 4) {
                  // Four equal rectangles
                  const halfWidth = (rectWidth - gap) / 2;
                  const halfHeight = (rectHeight - gap) / 2;
                  rects.push(
                    <path
                      key={0}
                      d={`M ${baseX + 4} ${baseY}
                         L ${baseX + halfWidth} ${baseY}
                         L ${baseX + halfWidth} ${baseY + halfHeight}
                         L ${baseX} ${baseY + halfHeight}
                         L ${baseX} ${baseY + 4}
                         Q ${baseX} ${baseY} ${baseX + 4} ${baseY}`}
                      fill={getActivityColor(intensities[0].activityIndex, intensities[0].intensity)}
                    />,
                    <path
                      key={1}
                      d={`M ${baseX + halfWidth + gap} ${baseY}
                         L ${baseX + rectWidth - 4} ${baseY}
                         Q ${baseX + rectWidth} ${baseY} ${baseX + rectWidth} ${baseY + 4}
                         L ${baseX + rectWidth} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY + halfHeight}
                         L ${baseX + halfWidth + gap} ${baseY}`}
                      fill={getActivityColor(intensities[1].activityIndex, intensities[1].intensity)}
                    />,
                    <path
                      key={2}
                      d={`M ${baseX} ${baseY + halfHeight + gap}
                         L ${baseX + halfWidth} ${baseY + halfHeight + gap}
                         L ${baseX + halfWidth} ${baseY + rectHeight}
                         L ${baseX + 4} ${baseY + rectHeight}
                         Q ${baseX} ${baseY + rectHeight} ${baseX} ${baseY + rectHeight - 4}
                         L ${baseX} ${baseY + halfHeight + gap}`}
                      fill={getActivityColor(intensities[2].activityIndex, intensities[2].intensity)}
                    />,
                    <path
                      key={3}
                      d={`M ${baseX + halfWidth + gap} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + halfHeight + gap}
                         L ${baseX + rectWidth} ${baseY + rectHeight - 4}
                         Q ${baseX + rectWidth} ${baseY + rectHeight} ${baseX + rectWidth - 4} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY + rectHeight}
                         L ${baseX + halfWidth + gap} ${baseY + halfHeight + gap}`}
                      fill={getActivityColor(intensities[3].activityIndex, intensities[3].intensity)}
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

                return <g>{rects}</g>;
              };

              return (
                <g
                  onClick={() => {
                    if (!isNaN(dateObj.getTime())) {
                      onDateClick(dateObj);
                    }
                  }}
                >
                  {renderRects()}
                </g>
              );
            }}
          />
        </div>
      </div>
      <div className="flex justify-start">{renderActivityLegend()}</div>
    </div>
  );
};

export default BaseHeatmapRenderer;
