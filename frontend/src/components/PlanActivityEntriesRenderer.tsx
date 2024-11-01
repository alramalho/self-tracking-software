import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Activity, Plan, ActivityEntry, useUserPlan } from "@/contexts/UserPlanContext";
import { Badge } from "./ui/badge";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";

interface PlanActivityEntriesRendererProps {
  plan: Plan;
  activities: Activity[];
  activityEntries: ActivityEntry[];
}

const PlanActivityEntriesRenderer: React.FC<PlanActivityEntriesRendererProps> = ({
  plan,
  activities,
  activityEntries,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const planActivities = useMemo(() => activities.filter(a => plan.sessions.some(s => s.activity_id === a.id)), [activities, plan.sessions]);
  const planActivityEntries = useMemo(() => activityEntries.filter(e => planActivities.some(a => a.id === e.activity_id)), [activityEntries, planActivities]);


  const formatEntriesForHeatMap = () => {
    return planActivityEntries.map((entry) => ({
      date: format(entry.date, "yyyy/MM/dd"),
      count: entry.quantity,
    }));
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
    const intensityStep = (maxQuantity - minQuantity) / intensityLevels;

    const intensity = Math.min(
      Math.floor((entry.quantity - minQuantity) / intensityStep),
      intensityLevels - 1
    );

    return { activityIndex, intensity };
  };

  useEffect(() => {
    console.log({planActivityEntries})
    console.log({planActivities})
  }, [planActivityEntries, planActivities])

  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const entriesOnDate = planActivityEntries.filter(
      (entry) =>
        format(entry.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    return (
      <div className="mt-4 p-4 border rounded-lg bg-white w-full max-w-md w-96">
        <h3 className="text-lg font-semibold mb-2">
          Activities on {format(focusedDate, "MMMM d, yyyy")}
        </h3>
        {entriesOnDate.length === 0 ? (
          <p>No activities recorded for this date.</p>
        ) : (
          <div>
            {entriesOnDate.map((entry, index) => (
              <div
                key={index}
                className="p-2 mb-2 rounded border border-gray-200"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {planActivities.map((activity, actIndex) => {
                    if (entry.activity_id === activity.id) {
                      const intensity = getIntensityForDate(format(entry.date, "yyyy-MM-dd"));
                      return (
                        <Badge
                          key={actIndex}
                          className={intensity ? `bg-[${intensity}]` : ""}
                        >
                          {activity.title}
                        </Badge>
                      );
                    }
                    return null;
                  })}
                </div>
                <p className="text-sm font-semibold">
                  Quantity: {entry.quantity}{" "}
                  {
                    activities.find(
                      (a) => a.id === entry.activity_id
                    )?.measure
                  }
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <BaseHeatmapRenderer
        activities={planActivities}
        startDate={new Date()}
        endDate={plan.finishing_date}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
      />
      <div className="flex justify-center mt-4">
        {renderActivityViewer()}
      </div>
    </>
  );
};

export default PlanActivityEntriesRenderer; 