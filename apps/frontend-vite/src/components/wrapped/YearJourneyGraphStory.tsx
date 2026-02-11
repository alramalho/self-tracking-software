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
      className={`min-h-full flex flex-col relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`, backgroundSize: "24px 24px" }} />
      <div className={`absolute top-[10%] left-[-15%] w-[50%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-indigo-200/30" : "bg-indigo-900/15"}`} />
      <div className={`absolute bottom-[5%] right-[-10%] w-[45%] h-[35%] rounded-full blur-3xl ${isLightMode ? "bg-pink-200/25" : "bg-pink-900/10"}`} />

      {/* Header */}
      <div className="p-6 pt-12 shrink-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center font-zalando-expanded-black font-black italic gap-3">

            <h2 className={`text-3xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>{year} Journey</h2>
          </div>
          {avgMood !== null && (
            <div className={`text-right ${isLightMode ? "text-neutral-900" : "text-white"}`}>
              <div className="text-2xl font-bold">{avgMood.toFixed(1)}</div>
              <div className={`text-xs ${isLightMode ? "text-neutral-400" : "text-white/70"}`}>avg mood</div>
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
              className={`flex items-center gap-1 px-3 py-1.5 backdrop-blur-sm rounded-full text-sm ${isLightMode ? "bg-neutral-100 text-neutral-700" : "bg-white/10 text-white"}`}
            >
              <span>{activity.emoji}</span>
              <span className="opacity-80">×{count}</span>
            </div>
          ))}
          <div className={`flex items-center px-3 py-1.5 backdrop-blur-sm rounded-full text-sm ${isLightMode ? "bg-neutral-50 text-neutral-400" : "bg-white/5 text-white/50"}`}>
            {yearActivityEntries.length} entries
          </div>
        </motion.div>
      </div>

      {/* Running Graph */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
        {(yearMetricEntries.length > 0 || yearActivityEntries.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex-1 min-h-0 flex flex-col"
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
