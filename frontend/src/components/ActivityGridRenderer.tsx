import React, { useState } from 'react';
import HeatMap from "@uiw/react-heat-map";
import toast from "react-hot-toast";
import { Activity } from '@/contexts/UserPlanContext';
import { ActivityEntry } from '@/app/see/page';

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
  const [selected, setSelected] = useState("");

  const getActivityEntries = (activityId: string) => {
    return activityEntries
      .filter((entry) => entry.activity_id === activityId)
      .map((entry) => ({
        date: entry.date.replaceAll("-", "/"),
        count: entry.quantity,
      }));
  };

  const generateMonthLabels = (startDate: Date) => {
    const labels = [];
    const currentDate = new Date(startDate);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    for (let i = 0; i < 12; i++) {
      const month = months[currentDate.getMonth()];
      const year = currentDate.getFullYear();
      labels.push(`${month} ${year}`);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return labels;
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

  const filterDataByTimeRange = (data: any[]) => {
    const currentDate = new Date();
    const startDate = new Date(
      timeRange === "Current Year"
        ? `${currentDate.getFullYear()}-01-01`
        : `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-01`
    );
    return data.filter((item) => new Date(item.date) >= startDate);
  };

  return (
    <>
      {activities.map((activity) => {
        const startDate = new Date(
          timeRange === "Current Year"
            ? `${new Date().getFullYear()}/01/01`
            : `${new Date().getFullYear()}/${new Date().getMonth() + 1}/01`
        );
        const endDate = new Date();
        const monthLabels = generateMonthLabels(startDate);
        const value = getActivityEntries(activity.id);
        const filteredValue = filterDataByTimeRange(value);

        return (
          <div key={activity.id} className="bg-white p-6 rounded-lg border-2 overflow-x-auto">
            <div className="flex items-center space-x-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {activity.title}
              </h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {activity.measure}
              </span>
            </div>
            <div className="relative">
              <HeatMap
                value={filteredValue}
                startDate={startDate}
                endDate={endDate}
                width={650}
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
                          const entry = activityEntries.find(
                            (e) =>
                              e.activity_id === activity.id &&
                              isSameDate(e.date, data.date.replaceAll("/", "-"))
                          );
                          const quantity = entry ? entry.quantity : 0;
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
                monthLabels={monthLabels}
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

export default ActivityGridRenderer;