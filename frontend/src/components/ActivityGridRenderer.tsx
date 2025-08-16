import React, { useState } from "react";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";
import { isSameDay, format } from "date-fns";
import { parseISO } from "date-fns";
import { subDays } from "date-fns";
import { Activity } from "@/zero/schema";
import { ActivityEntry } from "@/zero/schema";

interface ActivityGridRendererProps {
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRange: string;
  endDate?: Date;
}

const ActivityGridRenderer: React.FC<ActivityGridRendererProps> = ({
  activities,
  activityEntries,
  timeRange,
  endDate,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const getActivityEntriesData = () => {
    const result = activityEntries
      .filter((entry) =>
        activities.map((a) => a.id).includes(entry.activityId)
      )
      .map((entry) => ({
        date: new Date(entry.date).toISOString().replaceAll("-", "/"),
        count: entry.quantity,
      }));
    return result;
  };

  const getIntensityForDate = (date: string) => {
    const entriesOnDate = activityEntries.filter(
      (e: ActivityEntry) =>
        activities.map((a) => a.id).includes(e.activityId) &&
        isSameDay(e.date, date)
    );

    if (entriesOnDate.length === 0) return null;

    const intensities = entriesOnDate
      .map((entry) => {
        const activity = activities.find((a) => a.id === entry.activityId);
        if (!activity) return null;

        const activityIndex = activities.findIndex(
          (a) => a.id === entry.activityId
        );
        const activitySpecificEntries = activityEntries.filter(
          (e: ActivityEntry) => e.activityId === entry.activityId
        );

        const quantities = activitySpecificEntries.map((e) => e.quantity);
        const minQuantity = Math.min(...quantities);
        const maxQuantity = Math.max(...quantities);
        const intensityLevels = 5;
        const intensityStep =
          Math.max(maxQuantity - minQuantity, 1) / intensityLevels;

        const intensity = Math.min(
          Math.floor((entry.quantity - minQuantity) / intensityStep),
          intensityLevels - 1
        );

        return { activityIndex, intensity };
      })
      .filter(
        (item): item is { activityIndex: number; intensity: number } =>
          item !== null
      );

    return intensities;
  };

  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const entriesOnDate = activityEntries.filter(
      (entry) =>
        activities.map((a) => a.id).includes(entry.activityId) &&
        isSameDay(entry.date, focusedDate)
    );

    return (
      <div className="p-4 bg-gray-100/70 backdrop-blur-sm rounded-xl w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4 text-left">
          Activities on {format(focusedDate, "MMMM d, yyyy")}
        </h3>
        {entriesOnDate.length === 0 ? (
          <p className="text-center text-gray-500">
            No activities recorded for this date.
          </p>
        ) : (
          <ul className="list-none space-y-4">
            {entriesOnDate.map((entry, index) => {
              const activity = activities.find(
                (a) => a.id === entry.activityId
              );
              if (!activity) return null;

              return (
                <li key={index}>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{activity.emoji}</span>
                    <span className="text-md">{activity.title}</span>
                    <span className="text-sm mt-1 text-gray-600">
                      ({entry.quantity} {activity.measure})
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const startDate = subDays(new Date(), timeRange === "30 Days" ? 30 : 180);

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl border-2 overflow-x-auto">
        <div className="flex items-center space-x-3 mb-4">
            <span className="text-lg font-semibold text-gray-800">
              Non-plan activities
            </span>
            <span className="text-2xl font-semibold text-gray-800 ml-2">
              {activities.map((a) => a.emoji)}
            </span>
        </div>
        <div className="flex justify-center mb-4">{renderActivityViewer()}</div>
        
        <BaseHeatmapRenderer
          activities={activities}
          startDate={startDate}
          endDate={endDate}
          heatmapData={getActivityEntriesData()}
          onDateClick={setFocusedDate}
          getIntensityForDate={getIntensityForDate}
        />
      </div>
    </div>
  );
};

export default ActivityGridRenderer;
