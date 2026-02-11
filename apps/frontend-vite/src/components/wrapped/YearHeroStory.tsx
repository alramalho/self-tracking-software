import { useTheme } from "@/contexts/theme/useTheme";
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
  const { isLightMode } = useTheme();
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
    <div className={`min-h-full flex flex-col items-center justify-center p-8 ${isLightMode ? "bg-white" : "bg-neutral-950"}`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-3xl ${isLightMode ? "bg-violet-200/40" : "bg-violet-900/20"}`} />
      <div className={`absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-fuchsia-200/30" : "bg-fuchsia-900/15"}`} />

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
          className={`text-7xl font-zalando-expanded-black font-black italic tracking-tight mb-2 ${isLightMode ? "text-neutral-900" : "text-white"}`}
        >
          Your {year}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={`text-lg mb-12 ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
        >
          A year of growth
        </motion.p>

        {/* Stats */}
        <div className={`grid grid-cols-3 gap-8 ${isLightMode ? "text-neutral-900" : "text-white"}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center"
          >
            <div className="text-5xl font-mono font-black tabular-nums mb-1">{stats.daysTracked}</div>
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
            <div className="text-5xl font-mono font-black tabular-nums mb-1">{stats.totalStreaks}</div>
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
            <div className="text-5xl font-mono font-black tabular-nums mb-1">{stats.totalActivities}</div>
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
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 text-sm ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
      >
        Tap to continue
      </motion.div>
    </div>
  );
};

export default YearHeroStory;
