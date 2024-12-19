import React, { useEffect, useMemo, useState } from "react";
import { format, startOfWeek } from "date-fns";
import {
  Activity,
  Plan,
  ActivityEntry,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { Badge } from "./ui/badge";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";

interface PlanActivityEntriesRendererProps {
  plan: Plan;
  activities: Activity[];
  activityEntries: ActivityEntry[];
}

const PlanActivityEntriesRenderer: React.FC<
  PlanActivityEntriesRendererProps
> = ({ plan, activities, activityEntries }) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const planActivities = useMemo(
    () =>
      activities.filter((a) =>
        plan.sessions.some((s) => s.activity_id === a.id)
      ),
    [activities, plan.sessions]
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

  useEffect(() => {
  }, [beginingOfWeekOfFirstActivityEntry]);

  const formatEntriesForHeatMap = () => {
    const formattedEntries = planActivityEntries.map((entry) => ({
      date: format(entry.date, "yyyy/MM/dd"),
      count: entry.quantity,
    }));
    return formattedEntries;
  };

  const getIntensityForDate = (dateStr: string) => {
    const entry = planActivityEntries.find(
      (e) => format(e.date, "yyyy-MM-dd") === dateStr
    );

    if (!entry) return null;

    const activityIndex = planActivities.findIndex(
      (a) => a.id === entry.activity_id
    );

    const quantities = planActivityEntries.map((e) => e.quantity);
    const minQuantity = Math.min(...quantities);
    const maxQuantity = Math.max(...quantities);
    const intensityLevels = 5;
    const intensityStep = (Math.max(maxQuantity - minQuantity, 1) / intensityLevels);

    const intensity = Math.min(
      Math.floor((entry.quantity - minQuantity) / intensityStep),
      intensityLevels - 1
    );

    return { activityIndex, intensity };
  };


  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const entriesOnDate = planActivityEntries.filter(
      (entry) =>
        format(entry.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    return (
      <div className="mt-4 p-4 bg-white/50 backdrop-blur-sm rounded-xl w-full max-w-md border border-gray-200">
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
      <BaseHeatmapRenderer
        activities={planActivities}
        startDate={beginingOfWeekOfFirstActivityEntry}
        endDate={plan.finishing_date}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
      />
      <div className="flex justify-center mt-4">{renderActivityViewer()}</div>
    </div>
  );
};

export default PlanActivityEntriesRenderer;
