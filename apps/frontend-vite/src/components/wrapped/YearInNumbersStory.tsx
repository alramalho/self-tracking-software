import { useTheme } from "@/contexts/theme/useTheme";
import type { ActivityEntry, Activity } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo } from "react";

interface YearInNumbersStoryProps {
  year: number;
  activityEntries: ActivityEntry[];
  activities: Activity[];
}

export const YearInNumbersStory: React.FC<YearInNumbersStoryProps> = ({
  year,
  activityEntries,
  activities,
}) => {
  const { isLightMode } = useTheme();

  const ranked = useMemo(() => {
    const yearEntries = activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year && e.activityId
    );

    const counts = new Map<string, { days: Set<string>; totalQty: number }>();
    yearEntries.forEach((entry) => {
      const prev = counts.get(entry.activityId!) || { days: new Set<string>(), totalQty: 0 };
      const dayKey = new Date(entry.datetime).toISOString().split("T")[0];
      prev.days.add(dayKey);
      counts.set(entry.activityId!, {
        days: prev.days,
        totalQty: prev.totalQty + entry.quantity,
      });
    });

    return Array.from(counts.entries())
      .map(([activityId, { days, totalQty }]) => {
        const activity = activities.find((a) => a.id === activityId);
        if (!activity) return null;
        return { activity, days: days.size, totalQty };
      })
      .filter(Boolean)
      .sort((a, b) => b!.days - a!.days) as {
        activity: Activity;
        days: number;
        totalQty: number;
      }[];
  }, [activityEntries, activities, year]);

  const overallStats = useMemo(() => {
    const yearEntries = activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year && e.activityId
    );
    const uniqueDays = new Set(
      yearEntries.map((e) => new Date(e.datetime).toISOString().split("T")[0])
    );
    const uniqueActivities = new Set(yearEntries.map((e) => e.activityId));
    return { daysLogged: uniqueDays.size, activitiesCount: uniqueActivities.size };
  }, [activityEntries, year]);

  if (ranked.length === 0) return null;

  const podium = ranked.slice(0, 3);
  // Reorder for visual podium: [2nd, 1st, 3rd]
  const podiumDisplay = podium.length >= 3
    ? [podium[1], podium[0], podium[2]]
    : podium.length === 2
      ? [podium[1], podium[0]]
      : [podium[0]];
  const podiumHeights = podium.length >= 3
    ? [96, 128, 72]
    : podium.length === 2
      ? [96, 128]
      : [128];

  const formatNumber = (n: number) => n.toLocaleString();

  const listRow = (
    item: { activity: Activity; days: number; totalQty: number },
    rank: number,
    delay: number,
  ) => (
    <motion.div
      key={item.activity.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${isLightMode ? "bg-neutral-50/60" : "bg-white/5"}`}
    >
      <span className={`text-sm font-mono w-6 text-center ${isLightMode ? "text-neutral-400" : "text-white/40"}`}>
        {rank}
      </span>
      <span className="text-xl">{item.activity.emoji}</span>
      <div className={`flex-1 min-w-0 truncate text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}>
        {item.activity.title}
      </div>
      <div className={`text-sm text-right shrink-0 ${isLightMode ? "text-neutral-900" : "text-white"}`}>
        <div>
          <span className="font-mono font-semibold">{formatNumber(item.totalQty)}</span>
          {" "}
          <span className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>
            {item.activity.measure}
          </span>
        </div>
        <div className={`text-xs ${isLightMode ? "text-neutral-400" : "text-white/40"}`}>
          {item.days} {item.days === 1 ? "day" : "days"}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div
      className={`min-h-full flex flex-col relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
    >
      {/* Background */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <div className={`absolute top-[5%] right-[-10%] w-[50%] h-[50%] rounded-full blur-3xl ${isLightMode ? "bg-amber-200/30" : "bg-amber-900/15"}`} />
      <div className={`absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-orange-200/25" : "bg-orange-900/10"}`} />

      {/* Header */}
      <div className="p-6 pt-12 shrink-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-zalando-expanded-black font-black italic"
        >
          <h2 className={`text-3xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>
            {year}'s activities
          </h2>
        </motion.div>
      </div>

      <div className="px-6 relative z-10 flex-1 flex flex-col">
        {/* Stats bubble */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex justify-center gap-4 mb-6"
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm ${isLightMode ? "bg-amber-50/80 ring-1 ring-amber-200/50" : "bg-amber-500/10 ring-1 ring-amber-500/20"}`}>
            <span className={`text-2xl font-mono font-black ${isLightMode ? "text-amber-600" : "text-amber-400"}`}>
              {overallStats.daysLogged}
            </span>
            <span className={`text-xs ${isLightMode ? "text-amber-600/70" : "text-amber-400/70"}`}>
              active days
            </span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm ${isLightMode ? "bg-orange-50/80 ring-1 ring-orange-200/50" : "bg-orange-500/10 ring-1 ring-orange-500/20"}`}>
            <span className={`text-2xl font-mono font-black ${isLightMode ? "text-orange-600" : "text-orange-400"}`}>
              {overallStats.activitiesCount}
            </span>
            <span className={`text-xs ${isLightMode ? "text-orange-600/70" : "text-orange-400/70"}`}>
              different activities
            </span>
          </div>
        </motion.div>

        {/* Emoji podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-end justify-center gap-3 mb-8"
        >
          {podiumDisplay.map((item, idx) => {
            const height = podiumHeights[idx];
            const isFirst = item === podium[0];
            return (
              <motion.div
                key={item.activity.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height, opacity: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.4 + idx * 0.15,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                className={`w-24 rounded-t-2xl flex flex-col items-center justify-start pt-3 ${
                  isFirst
                    ? isLightMode
                      ? "bg-amber-100/80 ring-1 ring-amber-200"
                      : "bg-amber-500/15 ring-1 ring-amber-500/30"
                    : isLightMode
                      ? "bg-neutral-100/80 ring-1 ring-neutral-200/50"
                      : "bg-white/5 ring-1 ring-white/10"
                }`}
              >
                <span className="text-4xl mb-1">{item.activity.emoji}</span>
                <span className={`text-xs font-mono font-bold ${
                  isFirst ? "text-amber-500" : isLightMode ? "text-neutral-400" : "text-white/40"
                }`}>
                  {ranked.indexOf(item) + 1}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Full list */}
        <div className="space-y-2 pb-6">
          {ranked.map((item, idx) => listRow(item, idx + 1, 0.7 + idx * 0.05))}
        </div>
      </div>
    </div>
  );
};

export default YearInNumbersStory;
