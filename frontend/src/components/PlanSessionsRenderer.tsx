import React, { useState } from "react";
import { format } from "date-fns";
import { Activity, Plan } from "@/contexts/UserPlanContext";
import { Badge } from "./ui/badge";
import BaseHeatmapRenderer from "./common/BaseHeatmapRenderer";

interface PlanSessionsRendererProps {
  plan: Plan;
  activities: Activity[];
}

const PlanSessionsRenderer: React.FC<PlanSessionsRendererProps> = ({
  plan,
  activities,
}) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

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
    const session = plan.sessions.find(
      (s) => format(s.date, "yyyy-MM-dd") === dateStr
    );

    if (!session) return null;

    const activityIndex = activities.findIndex(
      (a) => a.id === session.activity_id
    );

    const quantities = plan.sessions.map((s) => s.quantity);
    const minQuantity = Math.min(...quantities);
    const maxQuantity = Math.max(...quantities);
    const intensityLevels = 5;
    const intensityStep = (maxQuantity - minQuantity) / intensityLevels;

    const intensity = Math.min(
      Math.floor((session.quantity - minQuantity) / intensityStep),
      intensityLevels - 1
    );

    return { activityIndex, intensity };
  };

  const renderActivityViewer = () => {
    if (!focusedDate) return null;

    const sessionsOnDate = plan.sessions.filter(
      (session) =>
        format(session.date, "yyyy-MM-dd") === format(focusedDate, "yyyy-MM-dd")
    );

    const isFinishingDate =
      plan.finishing_date &&
      format(plan.finishing_date, "yyyy-MM-dd") ===
        format(focusedDate, "yyyy-MM-dd");

    return (
      <div className="mt-4 p-4 border rounded-lg bg-white w-full max-w-md w-96">
        <h3 className="text-lg font-semibold mb-2">
          {isFinishingDate ? (
            <span>
              🎉 Finishing Date: {format(focusedDate, "MMMM d, yyyy")}
            </span>
          ) : (
            `Sessions on ${format(focusedDate, "MMMM d, yyyy")}`
          )}
        </h3>
        {isFinishingDate ? (
          <p>This is your goal completion date!</p>
        ) : sessionsOnDate.length === 0 ? (
          <p>No sessions scheduled for this date.</p>
        ) : (
          <div>
            {sessionsOnDate.map((session, index) => (
              <div
                key={index}
                className="p-2 mb-2 rounded border border-gray-200"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {activities.map((activity, actIndex) => {
                    if (session.activity_id === activity.id) {
                      const intensity = getIntensityForDate(format(session.date, "yyyy-MM-dd"));
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
                  Intensity: {session.quantity}{" "}
                  {
                    activities.find(
                      (a) => a.id === session.activity_id
                    )?.measure
                  }
                </p>
                <p className="text-sm">{session.descriptive_guide}</p>
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
        activities={activities}
        startDate={new Date()}
        endDate={plan.finishing_date}
        heatmapData={formatSessionsForHeatMap()}
        onDateClick={setFocusedDate}
        getIntensityForDate={getIntensityForDate}
      />
      <div className="flex justify-center mt-4">
        {renderActivityViewer()}
      </div>
    </>
  );
};

export default PlanSessionsRenderer; 