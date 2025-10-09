import { type CompletePlan } from "@/contexts/plans";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import { format, isSameWeek, startOfWeek } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import ActivityEditor from "./ActivityEditor";
import BaseHeatmapRenderer from "./BaseHeatmapRenderer";
interface PlanActivityEntriesRendererProps {
  plan: CompletePlan;
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
  const isWeekCompleted = (startDate: Date) => plan.progress.weeks.find((week) =>
    isSameWeek(week.startDate, startDate)
  )?.isCompleted ?? false;

  const planActivityEntries = activityEntries.filter((e) =>
    plan.activities?.map((a) => a.id).includes(e.activityId)
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
    const formattedEntries = planActivityEntries.map((entry) => {
      return {
        date: format(entry.date, "yyyy/MM/dd"),
        count: entry.quantity,
      };
    });
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
      const activityIndex = plan.activities.findIndex(
        (a) => a.id === entry.activityId
      );

      const quantities = planActivityEntries
        .filter((e) => e.activityId === entry.activityId)
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
    <div className="px-0">
      <div className="flex justify-center mb-4">{renderActivityViewer()}</div>

      <BaseHeatmapRenderer
        activities={plan.activities}
        startDate={getDefaultStartDate()}
        endDate={plan.finishingDate ? new Date(plan.finishingDate) : undefined}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
        getWeekCompletionStatus={(weekStartDate: Date) =>
          isWeekCompleted(weekStartDate)
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
