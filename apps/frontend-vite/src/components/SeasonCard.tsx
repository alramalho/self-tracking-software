import { useTheme } from "@/contexts/theme/useTheme";
import { type ActivityEntry, type MetricEntry, type Activity } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { MiniMonthlyHeatmap } from "./metrics/MiniMonthlyHeatmap";

type Season = "winter" | "spring" | "summer" | "fall";

interface SeasonCardProps {
  season: Season;
  year: number;
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  activities: Activity[];
}

const SEASON_CONFIG: Record<
  Season,
  {
    label: string;
    months: number[]; // 0-indexed
    gradient: { light: string; dark: string };
    emoji: string;
  }
> = {
  winter: {
    label: "Winter",
    months: [11, 0, 1], // Dec, Jan, Feb (Dec is from previous display year)
    gradient: {
      light: "from-sky-400 via-blue-500 to-indigo-500",
      dark: "from-sky-900 via-blue-900 to-indigo-900",
    },
    emoji: "❄️",
  },
  spring: {
    label: "Spring",
    months: [2, 3, 4], // Mar, Apr, May
    gradient: {
      light: "from-green-400 via-emerald-500 to-teal-500",
      dark: "from-green-900 via-emerald-900 to-teal-900",
    },
    emoji: "🌸",
  },
  summer: {
    label: "Summer",
    months: [5, 6, 7], // Jun, Jul, Aug
    gradient: {
      light: "from-amber-400 via-orange-500 to-rose-500",
      dark: "from-amber-900 via-orange-900 to-rose-900",
    },
    emoji: "☀️",
  },
  fall: {
    label: "Fall",
    months: [8, 9, 10], // Sep, Oct, Nov
    gradient: {
      light: "from-orange-400 via-amber-500 to-yellow-500",
      dark: "from-orange-900 via-amber-900 to-yellow-900",
    },
    emoji: "🍂",
  },
};

// Get evenly spaced photos from the season
const getSpacedPhotos = (
  entries: ActivityEntry[],
  maxPhotos: number = 3
): ActivityEntry[] => {
  const entriesWithPhotos = entries.filter((e) => e.imageUrl);
  if (entriesWithPhotos.length === 0) return [];
  if (entriesWithPhotos.length <= maxPhotos) return entriesWithPhotos;

  // Space them out evenly
  const result: ActivityEntry[] = [];
  const step = (entriesWithPhotos.length - 1) / (maxPhotos - 1);
  for (let i = 0; i < maxPhotos; i++) {
    const index = Math.round(i * step);
    result.push(entriesWithPhotos[index]);
  }
  return result;
};

export const SeasonCard: React.FC<SeasonCardProps> = ({
  season,
  year,
  metricEntries,
  activityEntries,
  activities,
}) => {
  const { isLightMode } = useTheme();
  const config = SEASON_CONFIG[season];

  // Filter entries for this season
  const seasonData = useMemo(() => {
    const isInSeason = (date: Date, months: number[]) => {
      const month = date.getMonth();
      const entryYear = date.getFullYear();

      // Handle December from previous year for winter
      if (season === "winter" && month === 11) {
        return entryYear === year - 1;
      }
      // Handle Jan/Feb for winter
      if (season === "winter" && (month === 0 || month === 1)) {
        return entryYear === year && months.includes(month);
      }
      // Normal case
      return entryYear === year && months.includes(month);
    };

    const seasonMetricEntries = metricEntries.filter((e) =>
      isInSeason(new Date(e.createdAt), config.months)
    );

    const seasonActivityEntries = activityEntries.filter((e) =>
      isInSeason(new Date(e.datetime), config.months)
    );

    // Calculate average mood
    const avgMood =
      seasonMetricEntries.length > 0
        ? seasonMetricEntries.reduce((sum, e) => sum + e.rating, 0) /
          seasonMetricEntries.length
        : null;

    // Count activities
    const activityCounts = new Map<string, number>();
    seasonActivityEntries.forEach((entry) => {
      if (!entry.activityId) return;
      const count = activityCounts.get(entry.activityId) || 0;
      activityCounts.set(entry.activityId, count + 1);
    });

    // Get top activities
    const topActivities = Array.from(activityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([activityId, count]) => {
        const activity = activities.find((a) => a.id === activityId);
        return { activity, count };
      })
      .filter((item) => item.activity);

    // Get spaced photos
    const photos = getSpacedPhotos(seasonActivityEntries, 3);

    return {
      metricEntries: seasonMetricEntries,
      activityEntries: seasonActivityEntries,
      avgMood,
      topActivities,
      photos,
      totalEntries: seasonActivityEntries.length,
    };
  }, [metricEntries, activityEntries, activities, config.months, year, season]);

  // Determine which months to show for mini heatmaps (adjust for winter)
  const displayMonths = useMemo(() => {
    if (season === "winter") {
      // For winter, show Dec (from prev year conceptually), Jan, Feb
      return [
        { month: 11, year: year - 1 },
        { month: 0, year },
        { month: 1, year },
      ];
    }
    return config.months.map((m) => ({ month: m, year }));
  }, [season, year, config.months]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full rounded-2xl overflow-hidden"
    >
      {/* Season Header */}
      <div
        className={`relative p-4 bg-gradient-to-br ${
          isLightMode ? config.gradient.light : config.gradient.dark
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.emoji}</span>
            <h3 className="text-xl font-bold text-white">{config.label}</h3>
          </div>
          {seasonData.avgMood !== null && (
            <div className="text-white text-right">
              <div className="text-lg font-bold">
                {seasonData.avgMood.toFixed(1)}
              </div>
              <div className="text-xs opacity-80">avg mood</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-card border border-t-0 border-border rounded-b-2xl space-y-4">
        {/* Photos Row - Instagram Story style */}
        {seasonData.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {seasonData.photos.map((entry, idx) => (
              <div
                key={entry.id}
                className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden ring-2 ring-offset-2 ring-offset-card ${
                  isLightMode ? "ring-purple-500" : "ring-violet-600"
                }`}
              >
                <img
                  src={entry.imageUrl!}
                  alt="Memory"
                  className="w-full h-full object-cover"
                />
                {/* Activity emoji overlay */}
                {activities.find((a) => a.id === entry.activityId)?.emoji && (
                  <div className="absolute bottom-0.5 right-0.5 text-sm bg-black/50 rounded-full w-5 h-5 flex items-center justify-center">
                    {activities.find((a) => a.id === entry.activityId)?.emoji}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mini Heatmaps Row */}
        <div className="grid grid-cols-3 gap-3">
          {displayMonths.map(({ month, year: y }) => (
            <MiniMonthlyHeatmap
              key={`${y}-${month}`}
              entries={metricEntries}
              year={y}
              month={month}
            />
          ))}
        </div>

        {/* Top Activities */}
        {seasonData.topActivities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {seasonData.topActivities.map(({ activity, count }) => (
              <div
                key={activity!.id}
                className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
              >
                <span>{activity!.emoji}</span>
                <span className="text-muted-foreground">×{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats summary */}
        <div className="text-xs text-muted-foreground text-center">
          {seasonData.totalEntries} activities logged
        </div>
      </div>
    </motion.div>
  );
};

export default SeasonCard;
