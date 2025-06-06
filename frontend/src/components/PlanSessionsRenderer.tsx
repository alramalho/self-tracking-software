import React, { useState } from "react";
import { format } from "date-fns";
import { Activity, Plan } from "@/contexts/UserPlanContext";
import { Badge } from "./ui/badge";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";

interface PlanSessionsRendererProps {
  plan: Plan;
  activities: Activity[];
  startDate?: Date;
}

const PlanSessionsRenderer: React.FC<PlanSessionsRendererProps> = ({
  plan,
  activities,
  startDate,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const getDefaultStartDate = () => {
    if (startDate) return startDate;
    if (plan.sessions.length === 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;
    }
    return plan.sessions.reduce((earliest, session) => 
      session.date < earliest ? session.date : earliest,
      plan.sessions[0].date
    );
  };

  const formatSessionsForHeatMap = () => {
    const sessions = plan.sessions.map((session) => ({
      date: format(session.date, "yyyy/MM/dd"),
      count: session.quantity,
    }));

    if (plan.finishing_date) {
      sessions.push({
        date: format(plan.finishing_date, "yyyy/MM/dd"),
        count: -1,
      });
    }

    return sessions;
  };

  const getIntensityForDate = (dateStr: string) => {
    const sessionsOnDate = plan.sessions.filter(
      (s) => format(s.date, "yyyy-MM-dd") === dateStr
    );

    if (sessionsOnDate.length === 0) return null;

    const intensities = sessionsOnDate.map(session => {
      const activityIndex = activities.findIndex(
        (a) => a.id === session.activity_id
      );

      const quantities = plan.sessions.map((s) => s.quantity);
      const minQuantity = Math.min(...quantities);
      const maxQuantity = Math.max(...quantities);
      const intensityLevels = 5;
      const intensityStep = (Math.max(maxQuantity-minQuantity, 1) / intensityLevels);

      const intensity = Math.min(
        Math.floor((session.quantity - minQuantity) / intensityStep),
        intensityLevels - 1
      );

      return { activityIndex, intensity };
    });

    return intensities;
  };
  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const sessionsOnDate = plan.sessions.filter(
      (session) =>
        format(session.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    return (
      <div className="p-4 bg-gray-100/70 backdrop-blur-sm rounded-xl w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4 text-left">
          Activities on {format(focusedDate, "MMMM d, yyyy")}
        </h3>
        {sessionsOnDate.length === 0 ? (
          <p className="text-center text-gray-500">
            No sessions scheduled for this date.
          </p>
        ) : (
          <ul className="list-none space-y-4">
            {sessionsOnDate.map((session, index) => {
              const activity = activities.find(
                (a) => a.id === session.activity_id
              );
              if (!activity) return null;

              return (
                <li key={index}>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{activity.emoji}</span>
                    <span className="text-md">{activity.title}</span>
                    <span className="text-sm mt-1 text-gray-600">
                      ({session.quantity} {activity.measure})
                    </span>
                  </div>
                  <p className="text-sm mt-1 text-gray-600">
                    {session.descriptive_guide}
                  </p>
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
        activities={activities}
        startDate={getDefaultStartDate()}
        endDate={plan.finishing_date}
        heatmapData={formatSessionsForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
      />
    </div>
  );
};

export default PlanSessionsRenderer;
