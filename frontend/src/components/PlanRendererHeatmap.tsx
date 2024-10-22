import React, { useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import HeatMap from "@uiw/react-heat-map";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneratedPlan } from "@/contexts/UserPlanContext";

interface PlanRendererProps {
  plan: GeneratedPlan;
  title: string;
}

const PlanRendererHeatmap: React.FC<PlanRendererProps> = ({ plan, title }) => {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

  const formatSessionsForHeatMap = (plan: GeneratedPlan) => {
    const sessions = plan.sessions.map((session) => ({
      date: format(session.date, "yyyy/MM/dd"),
      count: session.quantity,
    }));

    console.log({plan});
    console.log({sessions});

    if (plan.finishing_date) {
      sessions.push({
        date: format(plan.finishing_date, "yyyy/MM/dd"),
        count: -1,
      });
    }

    return sessions;
  };

  const getActivityColorMatrix = () => {
    const baseColors = [
      ["#9AE6B4", "#68D391", "#48BB78", "#38A169", "#2F855A"], // green
      ["#BEE3F8", "#90CDF4", "#63B3ED", "#4299E1", "#3182CE"], // blue
      ["#FEB2B2", "#FC8181", "#F56565", "#E53E3E", "#C53030"], // red
      ["#FAF089", "#F6E05E", "#ECC94B", "#D69E2E", "#B7791F"], // yellow
      ["#E9D8FD", "#D6BCFA", "#B794F4", "#9F7AEA", "#805AD5"], // purple
      ["#FED7E2", "#FBB6CE", "#F687B3", "#ED64A6", "#D53F8C"], // pink
      ["#C3DAFE", "#A3BFFA", "#7F9CF5", "#667EEA", "#5A67D8"], // indigo
      ["#E2E8F0", "#CBD5E0", "#A0AEC0", "#718096", "#4A5568"], // gray
    ];
    return baseColors;
  };

  const getActivityColor = (activityIndex: number, intensityLevel: number) => {
    const colorMatrix = getActivityColorMatrix();
    const row = colorMatrix[activityIndex % colorMatrix.length];
    return row[Math.min(intensityLevel, row.length - 1)];
  };

  const renderHeatMap = (plan: GeneratedPlan) => {
    const today = new Date();
    const endDate = plan.finishing_date
      ? addDays(plan.finishing_date, 1)
      : undefined;
    const heatmapData = formatSessionsForHeatMap(plan);

    // Calculate the number of weeks between today and the end date
    const numberOfWeeks = endDate
      ? Math.ceil((endDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 52; // Default to 52 weeks if no end date is specified

    const quantities = plan.sessions.map((session) => session.quantity);
    const minQuantity = Math.min(...quantities);
    const maxQuantity = Math.max(...quantities);

    const intensityLevels = 5;
    const intensityStep = (maxQuantity - minQuantity) / intensityLevels;

    return (
      <div className="mb-4">
        <div className="flex justify-center">
          <div className="flex flex-col">
            <HeatMap
              value={heatmapData}
              startDate={today}
              endDate={endDate}
              width={30 + 18 * numberOfWeeks}
              height={200}
              rectSize={14}
              legendRender={() => <></>}
              rectProps={{
                rx: 3,
              }}
              rectRender={(props, data) => {
                const session = plan.sessions.find(
                  (s) =>
                    format(s.date, "yyyy-MM-dd") ===
                    format(new Date(data.date), "yyyy-MM-dd")
                );

                let color = "#EBEDF0";

                if (session) {
                  const activityIndex = plan.activities.findIndex(
                    (a) => a.id === session.activity_id
                  );
                  const intensityLevel = Math.min(
                    Math.floor(
                      (session.quantity - minQuantity) / intensityStep
                    ),
                    intensityLevels - 1
                  );
                  if (activityIndex !== -1) {
                    color = getActivityColor(activityIndex, intensityLevel);
                  }
                }

                return (
                  <rect
                    key={data.index}
                    {...props}
                    fill={color}
                    onClick={() => {
                      const clickedDate = new Date(data.date);
                      if (!isNaN(clickedDate.getTime())) {
                        setFocusedDate(clickedDate);
                      }
                    }}
                  />
                );
              }}
            />
          </div>
        </div>
        <div className="flex justify-center mt-4">
          {renderActivityLegend(plan)}
        </div>
        <div className="flex justify-center mt-4">
          {renderActivityViewer(plan)}
        </div>
      </div>
    );
  };

  const renderActivityLegend = (plan: GeneratedPlan) => {
    const colorMatrix = getActivityColorMatrix();
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {plan.activities.map((activity, index) => (
          <div key={index} className="flex flex-col items-center">
            <span className="text-sm font-semibold mb-1">
              {activity.title} ({activity.measure})
            </span>
            <div className="flex">
              {colorMatrix[index % colorMatrix.length].map(
                (color, intensityIndex) => (
                  <div
                    key={intensityIndex}
                    className="w-4 h-4 mr-1"
                    style={{ backgroundColor: color }}
                    title={`Intensity level ${intensityIndex + 1}`}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActivityViewer = (plan: GeneratedPlan) => {
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
            `Activities on ${format(focusedDate, "MMMM d, yyyy")}`
          )}
        </h3>
        {isFinishingDate ? (
          <p>This is your goal completion date!</p>
        ) : sessionsOnDate.length === 0 ? (
          <p>No activities scheduled for this date.</p>
        ) : (
          <div>
            {sessionsOnDate.map((session, index) => (
              <div
                key={index}
                className="p-2 mb-2 rounded border border-gray-200"
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  {plan.activities.map((activity, actIndex) => {
                    if (
                      plan.sessions.find(
                        (s) =>
                          format(s.date, "yyyy-MM-dd") ===
                            format(focusedDate, "yyyy-MM-dd") &&
                          s.activity_id === activity.id
                      )
                    ) {
                      return (
                        <Badge
                          key={actIndex}
                          className={`${getActivityColor(
                            actIndex,
                            session.quantity
                          )}`}
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
                    plan.activities.find(
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
      <div className="p-4">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p>{plan.emoji ? plan.emoji : "Goal:"} {plan.goal}</p>
        <p>
          Finishing Date:{" "}
          {plan.finishing_date
            ? format(plan.finishing_date, "yyyy-MM-dd")
            : "Not specified"}
        </p>
        <p>Number of sessions: {plan.sessions.length}</p>
        <div className="mt-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Plan Overview:</h3>
          <p className="text-sm text-gray-600">{plan.overview}</p>
        </div>
        {renderHeatMap(plan)}
      </div>
    </>
  );
};

export default PlanRendererHeatmap;
