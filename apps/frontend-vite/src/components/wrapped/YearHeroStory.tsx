import { type ActivityEntry } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { motion } from "framer-motion";
import React, { useMemo } from "react";

interface YearHeroStoryProps {
  year: number;
  activityEntries: ActivityEntry[];
  plans: Array<{
    id: string;
    emoji: string | null;
    goal: string;
    progress: PlanProgressData;
  }>;
}

export const YearHeroStory: React.FC<YearHeroStoryProps> = ({
  year,
  activityEntries,
  plans,
}) => {
  const stats = useMemo(() => {
    const yearActivityEntries = activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year
    );

    const uniqueDays = new Set(
      yearActivityEntries.map((e) =>
        new Date(e.datetime).toISOString().split("T")[0]
      )
    );

    const totalStreaks = plans.reduce(
      (acc, plan) => acc + (plan.progress?.achievement?.streak || 0),
      0
    );

    return {
      daysTracked: uniqueDays.size,
      totalActivities: yearActivityEntries.length,
      totalStreaks,
    };
  }, [activityEntries, plans, year]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 text-center"
      >
        {/* Year title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-7xl font-black text-white tracking-tight mb-2"
          style={{
            textShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          Your {year}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-white/70 text-lg mb-12"
        >
          A year of growth
        </motion.p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center"
          >
            <div className="text-5xl font-bold mb-1">{stats.daysTracked}</div>
            <div className="text-sm opacity-70 uppercase tracking-wider">
              Days
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-center"
          >
            <div className="text-5xl font-bold mb-1">{stats.totalStreaks}</div>
            <div className="text-sm opacity-70 uppercase tracking-wider">
              Streaks
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-center"
          >
            <div className="text-5xl font-bold mb-1">{stats.totalActivities}</div>
            <div className="text-sm opacity-70 uppercase tracking-wider">
              Entries
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Tap hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/50 text-sm"
      >
        Tap to continue
      </motion.div>
    </div>
  );
};

export default YearHeroStory;
