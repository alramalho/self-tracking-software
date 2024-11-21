import React from 'react';
import toast from "react-hot-toast";
import { Activity, ActivityEntry } from '@/contexts/UserPlanContext';
import BaseHeatmapRenderer from './common/BaseHeatmapRenderer';

interface ActivityGridRendererProps {
  activities: Activity[];
  activityEntries: ActivityEntry[];
  timeRange: string;
}

const ActivityGridRenderer: React.FC<ActivityGridRendererProps> = ({
  activities,
  activityEntries,
  timeRange,
}) => {
  const getActivityEntries = (activityId: string) => {
    return activityEntries
      .filter((entry) => entry.activity_id === activityId)
      .map((entry) => ({
        date: entry.date.replaceAll("-", "/"),
        count: entry.quantity,
      }));
  };

  const getIntensityForDate = (activityId: string) => (date: string) => {
    const entry = activityEntries.find(
      (e) => e.activity_id === activityId && e.date === date
    );
    
    if (!entry) return null;

    // Calculate intensity level based on quantity
    // You might want to adjust these thresholds based on your needs
    const intensity = entry.quantity <= 2 ? 0 :
                     entry.quantity <= 4 ? 1 :
                     entry.quantity <= 10 ? 2 :
                     entry.quantity <= 20 ? 3 : 4;

    return {
      activityIndex: activities.findIndex(a => a.id === activityId),
      intensity
    };
  };

  const handleDateClick = (activity: Activity) => (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    const entry = activityEntries.find(
      (e) => e.activity_id === activity.id && e.date === formattedDate
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

  const startDate = new Date(
    timeRange === "Current Year"
      ? `${new Date().getFullYear()}/01/01`
      : `${new Date().getFullYear()}/${new Date().getMonth() + 1}/01`
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
              heatmapData={value}
              onDateClick={handleDateClick(activity)}
              getIntensityForDate={getIntensityForDate(activity.id)}
            />
          </div>
        );
      })}
    </>
  );
};

export default ActivityGridRenderer;