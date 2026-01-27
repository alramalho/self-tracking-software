import { useTheme } from "@/contexts/theme/useTheme";
import type { ActivityEntry, MetricEntry, Activity } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import { MiniMonthlyHeatmap } from "../metrics/MiniMonthlyHeatmap";
import { SeasonRunningGraph } from "./SeasonRunningGraph";
import { format } from "date-fns";

type Season = "winter" | "spring" | "summer" | "fall";
type StoryVariant = "photos" | "graph";

interface SeasonStoryProps {
  season: Season;
  year: number;
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  activities: Activity[];
  variant?: StoryVariant;
}

const SEASON_CONFIG: Record<
  Season,
  {
    label: string;
    months: number[];
    gradient: { light: string; dark: string };
    emoji: string;
  }
> = {
  winter: {
    label: "Winter",
    months: [11, 0, 1],
    gradient: {
      light: "from-sky-500 via-blue-600 to-indigo-700",
      dark: "from-sky-800 via-blue-900 to-indigo-950",
    },
    emoji: "❄️",
  },
  spring: {
    label: "Spring",
    months: [2, 3, 4],
    gradient: {
      light: "from-green-500 via-emerald-600 to-teal-600",
      dark: "from-green-800 via-emerald-900 to-teal-950",
    },
    emoji: "🌸",
  },
  summer: {
    label: "Summer",
    months: [5, 6, 7],
    gradient: {
      light: "from-amber-500 via-orange-500 to-rose-500",
      dark: "from-amber-800 via-orange-900 to-rose-950",
    },
    emoji: "☀️",
  },
  fall: {
    label: "Fall",
    months: [8, 9, 10],
    gradient: {
      light: "from-orange-500 via-amber-600 to-yellow-600",
      dark: "from-orange-800 via-amber-900 to-yellow-950",
    },
    emoji: "🍂",
  },
};

// Construct public S3 URL from the path
const getPublicImageUrl = (entry: ActivityEntry): string | null => {
  if (entry.imageS3Path) {
    return `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`;
  }
  return entry.imageUrl || null;
};

// Get evenly spaced photos from the season
const getSpacedPhotos = (
  entries: ActivityEntry[],
  maxPhotos: number = 3
): ActivityEntry[] => {
  const entriesWithPhotos = entries.filter((e) => e.imageS3Path || e.imageUrl);
  if (entriesWithPhotos.length === 0) return [];
  if (entriesWithPhotos.length <= maxPhotos) return entriesWithPhotos;

  const result: ActivityEntry[] = [];
  const step = (entriesWithPhotos.length - 1) / (maxPhotos - 1);
  for (let i = 0; i < maxPhotos; i++) {
    const index = Math.round(i * step);
    result.push(entriesWithPhotos[index]);
  }
  return result;
};

export const SeasonStory: React.FC<SeasonStoryProps> = ({
  season,
  year,
  metricEntries,
  activityEntries,
  activities,
  variant = "photos",
}) => {
  const { isLightMode } = useTheme();
  const config = SEASON_CONFIG[season];
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = (entryId: string) => {
    setFailedImages((prev) => new Set(prev).add(entryId));
  };

  const seasonData = useMemo(() => {
    const isInSeason = (date: Date, months: number[]) => {
      const month = date.getMonth();
      const entryYear = date.getFullYear();

      if (season === "winter" && month === 11) {
        return entryYear === year - 1;
      }
      if (season === "winter" && (month === 0 || month === 1)) {
        return entryYear === year && months.includes(month);
      }
      return entryYear === year && months.includes(month);
    };

    const seasonMetricEntries = metricEntries.filter((e) =>
      isInSeason(new Date(e.createdAt), config.months)
    );

    const seasonActivityEntries = activityEntries.filter((e) =>
      isInSeason(new Date(e.datetime), config.months)
    );

    const avgMood =
      seasonMetricEntries.length > 0
        ? seasonMetricEntries.reduce((sum, e) => sum + e.rating, 0) /
          seasonMetricEntries.length
        : null;

    const activityCounts = new Map<string, number>();
    seasonActivityEntries.forEach((entry) => {
      const count = activityCounts.get(entry.activityId) || 0;
      activityCounts.set(entry.activityId, count + 1);
    });

    const topActivities = Array.from(activityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([activityId, count]) => {
        const activity = activities.find((a) => a.id === activityId);
        return { activity, count };
      })
      .filter((item) => item.activity);

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

  const displayMonths = useMemo(() => {
    if (season === "winter") {
      return [
        { month: 11, year: year - 1 },
        { month: 0, year },
        { month: 1, year },
      ];
    }
    return config.months.map((m) => ({ month: m, year }));
  }, [season, year, config.months]);

  // Photos variant - shows images + basic stats
  if (variant === "photos") {
    return (
      <div
        className={`min-h-full flex flex-col bg-gradient-to-br ${
          isLightMode ? config.gradient.light : config.gradient.dark
        }`}
      >
        {/* Header */}
        <div className="p-6 pt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{config.emoji}</span>
              <h2 className="text-3xl font-bold text-white">{config.label}</h2>
            </div>
            {seasonData.avgMood !== null && (
              <div className="text-white text-right">
                <div className="text-2xl font-bold">
                  {seasonData.avgMood.toFixed(1)}
                </div>
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
            {seasonData.topActivities.map(({ activity, count }) => (
              <div
                key={activity!.id}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm"
              >
                <span>{activity!.emoji}</span>
                <span className="opacity-80">×{count}</span>
              </div>
            ))}
            <div className="flex items-center px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/70 text-sm">
              {seasonData.totalEntries} entries
            </div>
          </motion.div>
        </div>

        {/* Photos */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {seasonData.photos.filter((e) => !failedImages.has(e.id)).length > 0 ? (
            seasonData.photos
              .filter((e) => !failedImages.has(e.id))
              .map((entry, idx) => {
                const activity = activities.find((a) => a.id === entry.activityId);
                const imageUrl = getPublicImageUrl(entry);
                if (!imageUrl) return null;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
                    className="rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm"
                  >
                    <div className="relative aspect-square">
                      <img
                        src={imageUrl}
                        alt="Memory"
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(entry.id)}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                      {activity && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-full text-white text-sm">
                          <span>{activity.emoji}</span>
                          <span>{activity.title}</span>
                        </div>
                      )}
                      <div className="absolute bottom-3 right-3 text-white/80 text-sm">
                        {format(new Date(entry.datetime), "MMM d")}
                      </div>
                    </div>
                    {entry.description && (
                      <div className="p-4 text-white/90 text-sm leading-relaxed">
                        {entry.description}
                      </div>
                    )}
                  </motion.div>
                );
              })
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
            >
              <h3 className="text-white/80 text-sm font-medium mb-3 text-center">
                Your mood this season
              </h3>
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
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // Graph variant - shows the running graph animation
  return (
    <div
      className={`min-h-full flex flex-col bg-gradient-to-br ${
        isLightMode ? config.gradient.light : config.gradient.dark
      }`}
    >
      {/* Header - smaller for graph page */}
      <div className="p-6 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-4"
        >
          <span className="text-3xl">{config.emoji}</span>
          <h2 className="text-2xl font-bold text-white">{config.label} Journey</h2>
        </motion.div>

        {/* Running Graph */}
        {(seasonData.metricEntries.length > 0 || seasonData.activityEntries.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <SeasonRunningGraph
              metricEntries={seasonData.metricEntries}
              activityEntries={seasonData.activityEntries}
              topActivities={seasonData.topActivities.map((t) => ({
                activity: t.activity!,
                count: t.count,
              }))}
              animationDelay={0.2}
            />
          </motion.div>
        )}
      </div>

      {/* Mood heatmaps below graph */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
        >
          <h3 className="text-white/80 text-sm font-medium mb-3 text-center">
            Your mood
          </h3>
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
        </motion.div>
      </div>
    </div>
  );
};

export default SeasonStory;
