import { useTheme } from "@/contexts/theme/useTheme";
import { MiniMonthlyHeatmap } from "@/components/metrics/MiniMonthlyHeatmap";
import { type MetricEntry } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { getDay, getMonth, format, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MoodInsightsStoryProps {
  year: number;
  metricEntries: MetricEntry[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthStats {
  month: number;
  label: string;
  average: number;
  count: number;
  percentDiff: number;
}

interface DayStats {
  day: number;
  label: string;
  average: number;
  count: number;
  percentDiff: number;
}

export const MoodInsightsStory: React.FC<MoodInsightsStoryProps> = ({
  year,
  metricEntries,
}) => {
  const { isLightMode } = useTheme();

  // Filter entries for the year
  const yearEntries = useMemo(() => {
    return metricEntries.filter(
      (e) => new Date(e.createdAt).getFullYear() === year
    );
  }, [metricEntries, year]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (yearEntries.length === 0) return null;

    const ratings = yearEntries.map((e) => e.rating);
    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);

    return { average, min, max, count: ratings.length };
  }, [yearEntries]);

  // Calculate month-by-month stats
  const monthStats = useMemo(() => {
    if (!overallStats) return [];

    const monthGroups: { [key: number]: number[] } = {};
    for (let i = 0; i < 12; i++) monthGroups[i] = [];

    yearEntries.forEach((entry) => {
      const month = getMonth(new Date(entry.createdAt));
      monthGroups[month].push(entry.rating);
    });

    return MONTHS.map((label, month): MonthStats => {
      const ratings = monthGroups[month];
      const average = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      const percentDiff = overallStats.average > 0
        ? ((average - overallStats.average) / overallStats.average) * 100
        : 0;

      return { month, label, average, count: ratings.length, percentDiff };
    });
  }, [yearEntries, overallStats]);

  // Calculate day-of-week stats
  const dayStats = useMemo(() => {
    if (!overallStats) return [];

    const dayGroups: { [key: number]: number[] } = {};
    for (let i = 0; i < 7; i++) dayGroups[i] = [];

    yearEntries.forEach((entry) => {
      const day = getDay(new Date(entry.createdAt));
      dayGroups[day].push(entry.rating);
    });

    return SHORT_DAYS.map((label, day): DayStats => {
      const ratings = dayGroups[day];
      const average = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      const percentDiff = overallStats.average > 0
        ? ((average - overallStats.average) / overallStats.average) * 100
        : 0;

      return { day, label, average, count: ratings.length, percentDiff };
    });
  }, [yearEntries, overallStats]);

  // Find best and worst months
  const bestMonth = useMemo(() => {
    const significant = monthStats.filter((m) => m.count >= 3);
    if (significant.length === 0) return null;
    return significant.reduce((best, curr) =>
      curr.average > best.average ? curr : best
    );
  }, [monthStats]);

  const worstMonth = useMemo(() => {
    const significant = monthStats.filter((m) => m.count >= 3);
    if (significant.length === 0) return null;
    return significant.reduce((worst, curr) =>
      curr.average < worst.average ? curr : worst
    );
  }, [monthStats]);

  // Find best and worst days
  const bestDay = useMemo(() => {
    const significant = dayStats.filter((d) => d.count >= 3);
    if (significant.length === 0) return null;
    return significant.reduce((best, curr) =>
      curr.average > best.average ? curr : best
    );
  }, [dayStats]);

  const worstDay = useMemo(() => {
    const significant = dayStats.filter((d) => d.count >= 3);
    if (significant.length === 0) return null;
    return significant.reduce((worst, curr) =>
      curr.average < worst.average ? curr : worst
    );
  }, [dayStats]);

  // Generate mood line graph points
  const graphPoints = useMemo(() => {
    if (monthStats.length === 0) return "";

    const width = 100;
    const height = 40;
    const padding = 5;

    const points = monthStats.map((stat, idx) => {
      const x = padding + (idx / 11) * (width - padding * 2);
      const y = stat.count > 0
        ? height - padding - ((stat.average / 5) * (height - padding * 2))
        : height / 2;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [monthStats]);

  if (!overallStats || yearEntries.length < 7) {
    return (
      <div
        className={`h-full flex flex-col items-center justify-center ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
      >
        <span className="text-6xl mb-4">😊</span>
        <p className={isLightMode ? "text-neutral-400" : "text-white/70"}>Not enough mood data for {year}</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-full flex flex-col relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`, backgroundSize: "24px 24px" }} />
      <div className={`absolute top-[30%] right-[-15%] w-[50%] h-[30%] rounded-full blur-3xl ${isLightMode ? "bg-emerald-200/30" : "bg-emerald-900/15"}`} />

      {/* Header */}
      <div className="p-6 pt-12 shrink-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center font-zalando-expanded-black font-black italic gap-3 mb-2">
            <h2 className={`text-3xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>Your Mood</h2>
          </div>
          <p className={`text-sm ${isLightMode ? "text-neutral-400" : "text-white/70"}`}>
            {yearEntries.length} mood entries in {year}
          </p>
        </motion.div>

        {/* Overall average */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-4 mt-4"
        >
          <div className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-full ${isLightMode ? "bg-neutral-100 text-neutral-700" : "bg-white/10 text-white"}`}>
            <span className="text-2xl font-bold">{overallStats.average.toFixed(1)}</span>
            <span className="text-sm opacity-80">avg mood</span>
          </div>
        </motion.div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-4 pb-6 space-y-4 relative z-10">
        {/* Month-by-month graph */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={`rounded-2xl p-4 ${isLightMode ? "bg-neutral-100" : "bg-white/5"}`}
        >
          <h3 className={`text-sm font-medium mb-3 ${isLightMode ? "text-neutral-500" : "text-white/60"}`}>Mood by Month</h3>

          {/* SVG Line Graph */}
          <div className="h-24 mb-2">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
              {/* Grid lines */}
              {[1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="5"
                  y1={5 + (i / 5) * 30}
                  x2="95"
                  y2={5 + (i / 5) * 30}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="0.3"
                />
              ))}

              {/* Line */}
              <path
                d={graphPoints}
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points */}
              {monthStats.map((stat, idx) => {
                if (stat.count === 0) return null;
                const x = 5 + (idx / 11) * 90;
                const y = 35 - ((stat.average / 5) * 30);
                const isBest = bestMonth && stat.month === bestMonth.month;
                const isWorst = worstMonth && stat.month === worstMonth.month;
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={isBest || isWorst ? 2.5 : 1.5}
                    fill={isBest ? "#4ade80" : isWorst ? "#f87171" : "white"}
                  />
                );
              })}
            </svg>
          </div>

          {/* Month labels */}
          <div className="grid grid-cols-12 gap-0.5">
            {MONTHS.map((month, idx) => {
              const stat = monthStats[idx];
              const isBest = bestMonth && idx === bestMonth.month;
              const isWorst = worstMonth && idx === worstMonth.month;
              return (
                <div key={month} className="text-center">
                  <span className={`text-[9px] ${
                    isBest ? "text-green-400 font-bold" :
                    isWorst ? "text-red-400 font-bold" :
                    "text-white/50"
                  }`}>
                    {month.charAt(0)}
                  </span>
                  {stat.count > 0 && (
                    <div className={`text-[8px] ${
                      isBest ? "text-green-400" :
                      isWorst ? "text-red-400" :
                      "text-white/40"
                    }`}>
                      {stat.average.toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Best/Worst months */}
        {(bestMonth || worstMonth) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="grid grid-cols-2 gap-3"
          >
            {bestMonth && bestMonth.count >= 3 && (
              <div className="bg-green-500/20 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-xs font-medium">Best Month</span>
                </div>
                <div className="text-white font-bold text-lg">{bestMonth.label}</div>
                <div className="text-green-400 text-sm">
                  {bestMonth.average.toFixed(1)} avg
                </div>
              </div>
            )}
            {worstMonth && worstMonth.count >= 3 && (
              <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-xs font-medium">Hardest Month</span>
                </div>
                <div className="text-white font-bold text-lg">{worstMonth.label}</div>
                <div className="text-red-400 text-sm">
                  {worstMonth.average.toFixed(1)} avg
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Day of week patterns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className={`rounded-2xl p-4 ${isLightMode ? "bg-neutral-100" : "bg-white/5"}`}
        >
          <h3 className={`text-sm font-medium mb-3 ${isLightMode ? "text-neutral-500" : "text-white/60"}`}>Day of Week Patterns</h3>

          <div className="grid grid-cols-7 gap-1">
            {dayStats.map((stat) => {
              const barHeight = stat.count > 0 ? Math.max((stat.average / 5) * 100, 15) : 0;
              const isBest = bestDay && stat.day === bestDay.day;
              const isWorst = worstDay && stat.day === worstDay.day;

              return (
                <div key={stat.day} className="flex flex-col items-center gap-1">
                  <div className="h-12 w-full flex items-end justify-center">
                    {stat.count > 0 ? (
                      <div
                        className={`w-full rounded-t transition-all ${
                          isBest
                            ? "bg-green-400"
                            : isWorst
                            ? "bg-red-400"
                            : "bg-white/30"
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    ) : (
                      <div className="w-full h-1 bg-white/10 rounded" />
                    )}
                  </div>
                  <span className="text-[9px] text-white/60">{stat.label}</span>
                  {stat.count > 0 && (
                    <span className={`text-[8px] ${
                      isBest ? "text-green-400" :
                      isWorst ? "text-red-400" :
                      "text-white/40"
                    }`}>
                      {stat.average.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day insights */}
          {(bestDay || worstDay) && (
            <div className="mt-3 space-y-1">
              {bestDay && bestDay.percentDiff > 5 && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span>
                    Mood is <span className="text-green-400 font-medium">
                      {Math.abs(bestDay.percentDiff).toFixed(0)}% higher
                    </span> on {SHORT_DAYS[bestDay.day]}s
                  </span>
                </div>
              )}
              {worstDay && worstDay.percentDiff < -5 && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span>
                    Mood is <span className="text-red-400 font-medium">
                      {Math.abs(worstDay.percentDiff).toFixed(0)}% lower
                    </span> on {SHORT_DAYS[worstDay.day]}s
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Fun stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className={`rounded-2xl p-4 ${isLightMode ? "bg-neutral-100" : "bg-white/5"}`}
        >
          <h3 className={`text-sm font-medium mb-3 ${isLightMode ? "text-neutral-500" : "text-white/60"}`}>Quick Stats</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className={`text-2xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>{overallStats.max}</div>
              <div className={`text-[10px] ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>Best day</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>{overallStats.average.toFixed(1)}</div>
              <div className={`text-[10px] ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>Average</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>{overallStats.min}</div>
              <div className={`text-[10px] ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>Toughest day</div>
            </div>
          </div>
        </motion.div>

        {/* Monthly mood calendar grids */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className={`rounded-2xl p-4 ${isLightMode ? "bg-neutral-100" : "bg-white/5"}`}
        >
          <h3 className={`text-sm font-medium mb-3 ${isLightMode ? "text-neutral-500" : "text-white/60"}`}>Your mood calendar</h3>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.7 + i * 0.05 }}
                className="[&_.text-muted-foreground]:text-white/70"
              >
                <MiniMonthlyHeatmap
                  entries={yearEntries}
                  year={year}
                  month={i}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MoodInsightsStory;
