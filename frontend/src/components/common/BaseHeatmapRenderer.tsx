import React, { useState } from "react";
import { format, addDays, isToday } from "date-fns";
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
  const numberOfWeeks = endDate
    ? Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
    : 52;
  const renderActivityLegend = () => {
    const colorMatrix = getActivityColorMatrix();
    return (
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="flex items-center justify-end gap-2">
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
            <div className="flex flex-row gap-0 items-center justify-end">
              {colorMatrix[index % colorMatrix.length].map(
                (color, intensityIndex) => (
                  <div
                    key={intensityIndex}
                    className="w-4 h-4 mr-1"
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
    <div className="mb-4">
      <div className="flex justify-center">
        <div className="flex flex-col">
          <HeatMap
            value={heatmapData}
            startDate={startDate}
            endDate={endDate}
            width={30 + 18 * numberOfWeeks}
            height={150}
            rectSize={14}
            legendRender={() => <></>}
            rectProps={{
              rx: 3,
            }}
            rectRender={(props, data) => {
              let color = "#EBEDF0";
              let stroke = "none";
              let strokeWidth = 0;
              const dateObj = new Date(data.date);
              const intensity = getIntensityForDate(
                format(dateObj, "yyyy-MM-dd")
              );
              if (intensity && intensity.activityIndex !== -1) {
                color = getActivityColor(
                  intensity.activityIndex,
                  intensity.intensity
                );
              }

              // Check if the date is today
              if (isToday(dateObj)) {
                stroke = "#FF0000"; // Red border
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
                    const clickedDate = new Date(data.date);
                    if (!isNaN(clickedDate.getTime())) {
                      onDateClick(clickedDate);
                    }
                  }}
                />
              );
            }}
          />
        </div>
      </div>
      <div className="flex justify-center mt-4">{renderActivityLegend()}</div>
    </div>
  );
};

export default BaseHeatmapRenderer;
