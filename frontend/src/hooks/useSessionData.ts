import { useState, useEffect } from "react";
import {
  format,
  parseISO,
  isAfter,
  isToday,
  startOfWeek,
  addWeeks,
} from "date-fns";
import { ApiPlan } from "@/contexts/UserPlanContext";

export function useSessionData(
  selectedPlan: ApiPlan,
  getCompletedSessions: (plan: ApiPlan) => { date: string }[]
) {
  const [sessionData, setSessionData] = useState<
    { week: string; planned: number; completed: number | null }[]
  >([]);

  useEffect(() => {
    if (!selectedPlan) return;

    const completedSessions = getCompletedSessions(selectedPlan);
    const currentDate = new Date();

    const allDates = [
      ...selectedPlan.sessions.map((s) => parseISO(s.date)),
      ...completedSessions.map((s) => parseISO(s.date)),
    ].sort((a, b) => a.getTime() - b.getTime());

    if (allDates.length === 0) return;

    const startDate = startOfWeek(allDates[0]);
    const endDate = allDates[allDates.length - 1];

    let currentWeek = startDate;
    const weeklyData: {
      [key: string]: { planned: number; completed: number };
    } = {};

    while (currentWeek <= endDate) {
      const weekKey = format(currentWeek, "yyyy-MM-dd");
      weeklyData[weekKey] = { planned: 0, completed: 0 };
      currentWeek = addWeeks(currentWeek, 1);
    }

    let cumulativePlanned = 0;
    let cumulativeCompleted = 0;

    allDates.forEach((date) => {
      const weekKey = format(startOfWeek(date), "yyyy-MM-dd");
      if (
        selectedPlan.sessions.some(
          (s) => parseISO(s.date).getTime() === date.getTime()
        )
      ) {
        cumulativePlanned += 1;
      }
      if (
        completedSessions.some(
          (s) => parseISO(s.date).getTime() === date.getTime()
        )
      ) {
        if (!isAfter(date, currentDate)) {
          cumulativeCompleted += 1;
        }
      }
      weeklyData[weekKey].planned = cumulativePlanned;
      weeklyData[weekKey].completed = cumulativeCompleted;
    });

    const formattedData = Object.entries(weeklyData).map(([week, data]) => ({
      week: format(parseISO(week), "MMM d"),
      planned: data.planned,
      completed: isAfter(parseISO(week), currentDate) ? null : data.completed,
      fullDate: week,
    }));
    setSessionData(formattedData);
  }, [selectedPlan, getCompletedSessions]);

  return sessionData;
}
