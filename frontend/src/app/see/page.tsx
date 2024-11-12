"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ActivitiesRenderer from "@/components/ActivitiesRenderer";
import { useUserPlan } from "@/contexts/UserPlanContext";

interface MoodReport {
  id: string;
  date: string;
  score: number; // 0-10
}

// deprecated: don't delete, it's gonna comeback 
const SeePage: React.FC = () => {
  const [moodReports, setMoodReports] = useState<MoodReport[]>([]);
  const [timeRange, setTimeRange] = useState("Last 3 Months");
  const apiClient = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const activities = userDataQuery.data?.activities || [];
  const activityEntries = userDataQuery.data?.activityEntries || [];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const moodResponse = await apiClient.get<MoodReport[]>(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mood-reports`
        );
        setMoodReports(moodResponse.data);
      } catch (error) {
        console.error("Error fetching mood data:", error);
        toast.error("Failed to load mood data");
      }
    };

    fetchData();
  }, []);

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

      <ActivitiesRenderer activities={activities} activityEntries={activityEntries} />
    </div>
  );
};

export default SeePage;
