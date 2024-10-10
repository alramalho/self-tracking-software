"use client";

import React, { useEffect, useState } from "react";
import HeatMap from "@uiw/react-heat-map";
import toast from "react-hot-toast";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
} from "recharts";
import { useApiWithAuth } from "@/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity } from "@/contexts/UserPlanContext";

interface MoodReport {
  id: string;
  date: string;
  score: number; // 0-10
}

export interface ActivityEntry {
  id: string;
  activity_id: string;
  quantity: number;
  date: string;
}

const SeePage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [moodReports, setMoodReports] = useState<MoodReport[]>([]);
  const { clearNotifications } = useNotifications();
  const [selected, setSelected] = useState("");
  const [timeRange, setTimeRange] = useState("Last 3 Months");

  const apiClient = useApiWithAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [activitiesResponse, entriesResponse, moodResponse] =
          await Promise.all([
            apiClient.get<Activity[]>(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/activities`
            ),
            apiClient.get<ActivityEntry[]>(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/activity-entries`
            ),
            apiClient.get<MoodReport[]>(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mood-reports`
            ),
          ]);

        setActivities(activitiesResponse.data);
        setActivityEntries(entriesResponse.data);
        setMoodReports(moodResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      }
    };

    fetchData();
    clearNotifications();
  }, [clearNotifications]);

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

  const fillMissingDates = (data: MoodReport[]) => {
    if (data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startDate = new Date(sortedData[0].date);
    const endDate = new Date(sortedData[sortedData.length - 1].date);
    const filledData = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const existingReport = sortedData.find(report => 
        new Date(report.date).toDateString() === d.toDateString()
      );
      filledData.push({
        date: d.toISOString().split('T')[0],
        score: existingReport ? existingReport.score : null
      });
    }

    return filledData;
  };

  const moodChartData = fillMissingDates(filterDataByTimeRange(moodReports)).map((report) => ({
    date: new Date(report.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: report.score,
  }));

  return (
    <div className="p-4 space-y-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Activity and Mood Tracker</h1>
        <span className="text-sm text-gray-500">Last 3 Months</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mood Over Time</CardTitle>
          <CardDescription>
            Your mood scores over the last 3 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            width={800}
            height={300}
            data={moodChartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 10]} />
            <Tooltip />
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={'5%'} stopColor="#34B042" stopOpacity={0.8}/>
                <stop offset={'95%'} stopColor="#34B042" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="score"
              stroke="#34B042"
              fill="url(#splitColor)"
              connectNulls={true}
            />
            {moodChartData.map((entry, index) => (
              entry.score !== null && (
                <ReferenceDot
                  key={index}
                  x={entry.date}
                  y={entry.score}
                  r={4}
                  fill="#34B042"
                  stroke="#fff"
                />
              )
            ))}
          </AreaChart>
        </CardContent>
      </Card>

      {activities.map((activity) => {
        const { start: startDate, end: endDate } = getLastThreeMonths();
        const actvityEntries = getActivityEntries(activity.id);
        const filteredActivityEntries = filterDataByTimeRange(actvityEntries);

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
                          const entry = activityEntries.find(
                            (e) =>{
                              console.log({eDate: e.date})
                              console.log({dataDate: data.date})
                              return(
                              e.activity_id === activity.id &&
                              isSameDate(e.date, data.date.replaceAll("/", "-")))}
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
                // monthLabels={monthLabels}
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
    </div>
  );
};

export default SeePage;