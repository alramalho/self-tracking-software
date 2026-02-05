import { useTheme } from "@/contexts/theme/useTheme";
import type { ActivityEntry, MetricEntry, Activity } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { SeasonRunningGraph } from "./SeasonRunningGraph";

interface YearJourneyGraphStoryProps {
  year: number;
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  activities: Activity[];
}

export const YearJourneyGraphStory: React.FC<YearJourneyGraphStoryProps> = ({
  year,
  metricEntries,
  activityEntries,
  activities,
}) => {
  const { isLightMode } = useTheme();

  // Filter entries for the year
  const yearMetricEntries = useMemo(() => {
    return metricEntries.filter(
      (e) => new Date(e.createdAt).getFullYear() === year
    );
  }, [metricEntries, year]);

  const yearActivityEntries = useMemo(() => {
    return activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year
    );
  }, [activityEntries, year]);

  // Calculate top activities for the year
  const topActivities = useMemo(() => {
    const activityCounts = new Map<string, number>();
    yearActivityEntries.forEach((entry) => {
      if (!entry.activityId) return;
      const count = activityCounts.get(entry.activityId) || 0;
      activityCounts.set(entry.activityId, count + 1);
    });

    return Array.from(activityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([activityId, count]) => {
        const activity = activities.find((a) => a.id === activityId);
        return { activity: activity!, count };
      })
      .filter((item) => item.activity);
  }, [yearActivityEntries, activities]);

  // Calculate overall stats
  const avgMood = useMemo(() => {
    if (yearMetricEntries.length === 0) return null;
    return (
      yearMetricEntries.reduce((sum, e) => sum + e.rating, 0) /
      yearMetricEntries.length
    );
  }, [yearMetricEntries]);

  return (
    <div
      className={`h-full flex flex-col ${
        isLightMode
          ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
          : "bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-950"
      }`}
    >
      {/* Header */}
      <div className="p-6 pt-12 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-4xl">📈</span>
            <h2 className="text-3xl font-bold text-white">{year} Journey</h2>
          </div>
          {avgMood !== null && (
            <div className="text-white text-right">
              <div className="text-2xl font-bold">{avgMood.toFixed(1)}</div>
              <div className="text-xs opacity-70">avg mood</div>
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-wrap gap-2 mt-4"
        >
          {topActivities.map(({ activity, count }) => (
            <div
              key={activity.id}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm"
            >
              <span>{activity.emoji}</span>
              <span className="opacity-80">×{count}</span>
            </div>
          ))}
          <div className="flex items-center px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/70 text-sm">
            {yearActivityEntries.length} entries
          </div>
        </motion.div>
      </div>

      {/* Running Graph */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {(yearMetricEntries.length > 0 || yearActivityEntries.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <SeasonRunningGraph
              metricEntries={yearMetricEntries}
              activityEntries={yearActivityEntries}
              allActivityEntries={yearActivityEntries}
              activities={activities}
              topActivities={topActivities}
              animationDelay={0.3}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default YearJourneyGraphStory;
