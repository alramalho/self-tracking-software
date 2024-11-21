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
  ) => { activityIndex: number; intensity: number } | null;
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
        {activities.map((activity, index) => (
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
            width={45 + 24 * numberOfWeeks}
            height={200}
            rectSize={18}
            legendRender={() => <></>}
            rectProps={{
              rx: 4,
            }}
            rectRender={(props, data) => {
              // Convert date string to UTC Date object
              const [year, month, day] = data.date.split('/').map(Number);
              const dateObj = new Date(Date.UTC(year, month - 1, day));
              
              let color = "#EBEDF0";
              let stroke = "none";
              let strokeWidth = 0;
              
              const intensity = getIntensityForDate(
                format(dateObj, "yyyy-MM-dd")
              );
              if (intensity && intensity.activityIndex !== -1) {
                color = getActivityColor(
                  intensity.activityIndex,
                  intensity.intensity
                );
              }

              // Compare UTC dates for today check
              const today = new Date();
              const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
              if (dateObj.getTime() === todayUTC.getTime()) {
                stroke = "#FF0000";
                strokeWidth = 2;
              }

              return (
                <rect
                  key={data.index}
                  {...props}
                  fill={color}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  onClick={() => {
                    if (!isNaN(dateObj.getTime())) {
                      onDateClick(dateObj);
                    }
                  }}
                />
              );
            }}
          />
        </div>
      </div>
      <div className="flex justify-start mt-4">{renderActivityLegend()}</div>
    </div>
  );
};

export default BaseHeatmapRenderer;
