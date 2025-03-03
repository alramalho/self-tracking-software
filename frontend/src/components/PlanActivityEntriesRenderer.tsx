import React, { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, isBefore, isAfter } from "date-fns";
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
  startDate?: Date;
  endDate?: Date;
}

const PlanActivityEntriesRenderer: React.FC<
  PlanActivityEntriesRendererProps
> = ({ plan, activities, activityEntries, startDate, endDate }) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

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

  const isWeekCompleted = (weekStartDate: Date) => {
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 }); // 0 = Sunday
    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 0 }); // 0 = Sunday
    
    console.log("Checking week completion:", {
      weekStartDate: format(weekStart, "yyyy-MM-dd"),
      weekEndDate: format(weekEndDate, "yyyy-MM-dd"),
      planType: plan.outline_type,
      originalDate: format(weekStartDate, "yyyy-MM-dd")
    });
    
    if (plan.outline_type === "times_per_week") {
      // For times_per_week plans, count unique days with activities
      const entriesThisWeek = planActivityEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return isAfter(entryDate, weekStart) && isBefore(entryDate, weekEndDate);
      });

      // Get unique days by formatting dates and using Set
      const uniqueDaysWithActivities = new Set(
        entriesThisWeek.map(entry => format(new Date(entry.date), "yyyy-MM-dd"))
      );
      
      console.log("Times per week plan:", {
        targetTimes: plan.times_per_week,
        uniqueDaysCount: uniqueDaysWithActivities.size,
        uniqueDays: Array.from(uniqueDaysWithActivities),
        totalEntries: entriesThisWeek.length,
        allEntries: entriesThisWeek.map(e => format(new Date(e.date), "yyyy-MM-dd"))
      });
      
      return uniqueDaysWithActivities.size >= (plan.times_per_week || 0);
    } else {
      // For specific plans, check if all planned sessions for the week are completed
      const plannedSessionsThisWeek = plan.sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEndDate);
      });

      console.log("Specific plan - planned sessions:", {
        totalPlanned: plannedSessionsThisWeek.length,
        sessions: plannedSessionsThisWeek.map(s => ({
          date: format(new Date(s.date), "yyyy-MM-dd"),
          activityId: s.activity_id
        }))
      });

      // If no sessions planned this week, return false
      if (plannedSessionsThisWeek.length === 0) {
        console.log("No sessions planned this week");
        return false;
      }

      // Check if all planned sessions have corresponding entries
      const allSessionsCompleted = plannedSessionsThisWeek.every(session => {
        const sessionDate = new Date(session.date);
        const weekStart = startOfWeek(sessionDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(sessionDate, { weekStartsOn: 0 });
        
        const completedSessionsThisWeek = planActivityEntries.filter(entry => 
          entry.activity_id === session.activity_id &&
          isAfter(new Date(entry.date), weekStart) &&
          isBefore(new Date(entry.date), weekEnd)
        );

        console.log("Checking session completion:", {
          sessionDate: format(sessionDate, "yyyy-MM-dd"),
          weekStart: format(weekStart, "yyyy-MM-dd"),
          weekEnd: format(weekEnd, "yyyy-MM-dd"),
          activityId: session.activity_id,
          completedSessions: completedSessionsThisWeek.map(e => format(new Date(e.date), "yyyy-MM-dd")),
          isCompleted: completedSessionsThisWeek.length > 0
        });

        return completedSessionsThisWeek.length > 0;
      });

      console.log("Week completion result:", {
        weekStart: format(weekStart, "yyyy-MM-dd"),
        isCompleted: allSessionsCompleted
      });

      return allSessionsCompleted;
    }
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
        startDate={getDefaultStartDate()}
        endDate={plan.finishing_date}
        heatmapData={formatEntriesForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
        getWeekCompletionStatus={isWeekCompleted}
      />
      <div className="flex justify-center mt-4">{renderActivityViewer()}</div>
    </div>
  );
};

export default PlanActivityEntriesRenderer;
