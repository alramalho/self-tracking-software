import React, { useState } from "react";
import HeatMap from "@uiw/react-heat-map";
import toast from "react-hot-toast";
import { Activity, ActivityEntry } from "@/contexts/UserPlanContext";

interface ActivitiesRendererProps {
  activities: Activity[];
  activityEntries: ActivityEntry[];
}

const ActivitiesRenderer: React.FC<ActivitiesRendererProps> = ({ activities, activityEntries }) => {
  const [selected, setSelected] = useState("");

  const getActivityEntries = (activityId: string) => {
    return activityEntries
      .filter((entry) => entry.activity_id === activityId)
      .map((entry) => ({
        date: entry.date.replaceAll("-", "/").split("T")[0],
        count: entry.quantity,
      }));
  };

  const getLastThreeMonths = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
    return { start, end };
  };

  const filterDataByTimeRange = (data: any[]) => {
    const { start, end } = getLastThreeMonths();
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= start && itemDate <= end;
    });
  };

  const isSameDate = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <>
      {activities.map((activity) => {
        const { start: startDate, end: endDate } = getLastThreeMonths();
        const relevantActivityEntries = getActivityEntries(activity.id);
        const filteredActivityEntries = filterDataByTimeRange(relevantActivityEntries);

        return (
          <div key={activity.id} className="bg-white p-6 rounded-lg border-2 overflow-x-auto">
            <div className="flex items-center space-x-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {activity.emoji ? `${activity.emoji} ${activity.title}` : activity.title}
              </h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {activity.measure}
              </span>
            </div>
            <div className="relative">
              <HeatMap
                value={filteredActivityEntries}
                startDate={startDate}
                endDate={endDate}
                height={200}
                rectSize={14}
                rectRender={(props, data) => {
                  props.opacity = 0.9;
                  if (selected !== "") {
                    props.opacity = data.date === selected ? 1 : 0.9;
                  }
                  return (
                    <rect
                      {...props}
                      onClick={() => {
                        if (data.date !== selected) {
                          const entry = relevantActivityEntries.find(
                            (e) => isSameDate(e.date, data.date.replaceAll("/", "-"))
                          );
                          const quantity = entry ? entry.count : 0;
                          if (quantity > 0) {
                            toast.success(
                              `On ${data.date} you have done "${activity.title}" ${quantity} ${activity.measure}!`
                            );
                          } else {
                            toast.error(
                              `On ${data.date} you have not done "${activity.title}"!`
                            );
                          }
                        } else {
                          setSelected("");
                        }
                      }}
                    />
                  );
                }}
                legendCellSize={12}
                rectProps={{
                  rx: 3,
                }}
                legendRender={(props) => (
                  // @ts-ignore
                  <rect {...props} y={props.y + 10} rx={props.range} />
                )}
                panelColors={{
                  0: "#EBEDF0",
                  2: "#9BE9A8",
                  4: "#40C463",
                  10: "#30A14E",
                  20: "#216E39",
                }}
                weekLabels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
              />
            </div>
          </div>
        );
      })}
    </>
  );
};

export default ActivitiesRenderer;
