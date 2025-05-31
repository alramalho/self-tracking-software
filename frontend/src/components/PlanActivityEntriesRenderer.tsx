import React, { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";
import { Activity, Plan, ActivityEntry } from "@/contexts/UserPlanContext";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";
import ActivityEditor from "./ActivityEditor";
import { isWeekCompleted } from "@/contexts/PlanProgressContext/lib";

interface PlanActivityEntriesRendererProps {
  plan: Plan;
  activities: Activity[];
  activityEntries: ActivityEntry[];
  startDate?: Date;
  endDate?: Date;
}

const PlanActivityEntriesRenderer: React.FC<
  PlanActivityEntriesRendererProps
> = ({ plan, activities, activityEntries, startDate, endDate }) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(false);

  const planActivities = useMemo(
    () => activities.filter((a) => plan.activity_ids?.includes(a.id)),
    [activities, plan.activity_ids]
  );
  const planActivityEntries = useMemo(
    () =>
      activityEntries.filter((e) =>
        planActivities.some((a) => a.id === e.activity_id)
      ),
    [activityEntries, planActivities]
  );

  const beginingOfWeekOfFirstActivityEntry = useMemo(() => {
    if (planActivityEntries.length === 0) return new Date();
    const sortedPlanActivityEntries = planActivityEntries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstActivityEntry = sortedPlanActivityEntries[0];
    const beginingOfWeek = startOfWeek(firstActivityEntry.date);
    return beginingOfWeek;
  }, [planActivityEntries]);

  useEffect(() => {}, [beginingOfWeekOfFirstActivityEntry]);

  const getDefaultStartDate = () => {
    if (startDate) return startDate;
    if (planActivityEntries.length === 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;
    }
    return beginingOfWeekOfFirstActivityEntry;
  };

  const formatEntriesForHeatMap = () => {
    const formattedEntries = planActivityEntries.map((entry) => ({
      date: format(entry.date, "yyyy/MM/dd"),
      count: entry.quantity,
    }));
    return formattedEntries;
  };

  const handleOpenActivityEditor = (activity: Activity) => {
    setEditingActivity(activity);
    setIsActivityEditorOpen(true);
  };

  const handleCloseActivityEditor = () => {
    setEditingActivity(null);
    setIsActivityEditorOpen(false);
  };

  const getIntensityForDate = (dateStr: string) => {
    const entriesOnDate = planActivityEntries.filter(
      (e) => format(e.date, "yyyy-MM-dd") === dateStr
    );

    if (entriesOnDate.length === 0) return null;

    const intensities = entriesOnDate.map((entry) => {
      const activityIndex = planActivities.findIndex(
        (a) => a.id === entry.activity_id
      );

      const quantities = planActivityEntries
        .filter((e) => e.activity_id === entry.activity_id)
        .map((e) => e.quantity);
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
    });

    return intensities;
  };

  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const entriesOnDate = planActivityEntries.filter(
      (entry) =>
        format(entry.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    return (
      <div className="p-4 bg-white/50 backdrop-blur-sm rounded-xl w-full max-w-md border border-gray-200">
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
                (a) => a.id === entry.activity_id
              );
              if (!activity) return null;

              return (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-3xl">{activity.emoji}</span>
                  <span className="text-md">{activity.title}</span>
                  <span className="text-sm mt-1 text-gray-600">
                    ({entry.quantity} {activity.measure})
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="px-4">
      <div className="flex justify-center mb-4">{renderActivityViewer()}</div>
      
      <BaseHeatmapRenderer
        activities={planActivities}
        startDate={getDefaultStartDate()}
        endDate={plan.finishing_date}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
        getWeekCompletionStatus={(weekStartDate: Date) =>
          isWeekCompleted(weekStartDate, plan, planActivityEntries)
        }
        onEditActivity={handleOpenActivityEditor}
      />
      {editingActivity && (
        <ActivityEditor
          open={isActivityEditorOpen}
          onClose={handleCloseActivityEditor}
          activity={editingActivity}
        />
      )}
    </div>
  );
};

export default PlanActivityEntriesRenderer;
