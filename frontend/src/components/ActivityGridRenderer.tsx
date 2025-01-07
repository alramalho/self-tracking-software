import React, { useEffect } from 'react';
import toast from "react-hot-toast";
import { Activity, ActivityEntry } from '@/contexts/UserPlanContext';
import BaseHeatmapRenderer from './common/BaseHeatmapRenderer';
import { isSameDay } from 'date-fns';
import { parseISO } from 'date-fns';
import { subDays } from 'date-fns';

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
  endDate
}) => {

  const getActivityEntries = (activityId: string) => {
    const result = activityEntries
      .filter((entry) => entry.activity_id === activityId)
      .map((entry) => ({
        date: entry.date.replaceAll("-", "/"),
        count: entry.quantity,
      }));
    return result;
  };

  const getIntensityForDate = (activityId: string) => (date: string) => {
    const entriesOnDate = activityEntries.filter(
      (e) => e.activity_id === activityId && isSameDay(parseISO(e.date), date)
    );
    
    if (entriesOnDate.length === 0) return null;

    const intensities = entriesOnDate.map(entry => {
      const activityIndex = activities.findIndex(a => a.id === activityId);

      const quantities = activityEntries
        .filter(e => e.activity_id === activityId)
        .map(e => e.quantity);
      const minQuantity = Math.min(...quantities);
      const maxQuantity = Math.max(...quantities);
      const intensityLevels = 5;
      const intensityStep = (Math.max(maxQuantity-minQuantity, 1) / intensityLevels);

      const intensity = Math.min(
        Math.floor((entry.quantity - minQuantity) / intensityStep),
        intensityLevels - 1
      );

      return { activityIndex, intensity };
    });

    return intensities;
  };

  const handleDateClick = (activity: Activity) => (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    const entry = activityEntries.find(
      (e) => e.activity_id === activity.id && isSameDay(parseISO(e.date), date)
    );
    
    const quantity = entry ? entry.quantity : 0;
    if (quantity > 0) {
      toast.success(
        `On ${formattedDate} you have done "${activity.title}" ${quantity} ${activity.measure}!`
      );
    } else {
      toast.error(
        `On ${formattedDate} you have not done "${activity.title}"!`
      );
    }
  };

  const startDate = subDays(
    new Date(),
    timeRange === "30 Days" ? 30 : 180
  );

  return (
    <>
      {activities.map((activity) => {
        const value = getActivityEntries(activity.id);

        return (
          <div key={activity.id} className="bg-white p-6 rounded-lg border-2 overflow-x-auto">
            <div className="flex items-center space-x-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {activity.emoji} {activity.title}
              </h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {activity.measure}
              </span>
            </div>
            <BaseHeatmapRenderer
              activities={[activity]}
              startDate={startDate}
              endDate={endDate}
              heatmapData={value}
              onDateClick={handleDateClick(activity)}
              noActivityLegend
              getIntensityForDate={getIntensityForDate(activity.id)}
            />
          </div>
        );
      })}
    </>
  );
};

export default ActivityGridRenderer;