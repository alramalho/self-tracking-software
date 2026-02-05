import { useTheme } from "@/contexts/theme/useTheme";
import type { ActivityEntry, Activity } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { motion } from "framer-motion";
import React, { useMemo, useState, useCallback } from "react";

interface PlanBreakdownStoryProps {
  plan: {
    id: string;
    emoji: string | null;
    goal: string;
    progress: PlanProgressData;
    activities: Activity[];
  };
  activityEntries: ActivityEntry[];
  colorIndex: number;
}

const GRADIENTS_LIGHT = [
  "from-rose-500 via-pink-600 to-purple-600",
  "from-blue-500 via-indigo-600 to-violet-600",
  "from-amber-500 via-orange-600 to-red-600",
  "from-teal-500 via-emerald-600 to-green-600",
];

const GRADIENTS_DARK = [
  "from-rose-900 via-pink-950 to-purple-950",
  "from-blue-900 via-indigo-950 to-violet-950",
  "from-amber-900 via-orange-950 to-red-950",
  "from-teal-900 via-emerald-950 to-green-950",
];

const getPublicImageUrl = (entry: ActivityEntry): string | null => {
  if (entry.imageS3Path) {
    return `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`;
  }
  return entry.imageUrl || null;
};

export const PlanBreakdownStory: React.FC<PlanBreakdownStoryProps> = ({
  plan,
  activityEntries,
  colorIndex,
}) => {
  const { isLightMode } = useTheme();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((entryId: string) => {
    setFailedImages((prev) => new Set(prev).add(entryId));
  }, []);

  const gradients = isLightMode ? GRADIENTS_LIGHT : GRADIENTS_DARK;
  const gradient = gradients[colorIndex % gradients.length];

  const streak = plan.progress?.achievement?.streak || 0;
  const isLifestyle = plan.progress?.lifestyleAchievement?.isAchieved;
  const isHabit = plan.progress?.habitAchievement?.isAchieved;

  const badgeLabel = isLifestyle ? "Lifestyle" : "Habit";
  const badgeEmoji = isLifestyle ? "🚀" : "🌱";

  const planActivityIds = useMemo(() => {
    return new Set(plan.activities.map((a) => a.id));
  }, [plan.activities]);

  const topPhotos = useMemo(() => {
    return activityEntries
      .filter((e) => {
        if (!e.activityId || !planActivityIds.has(e.activityId)) return false;
        const url = getPublicImageUrl(e);
        return url && !failedImages.has(e.id);
      })
      .map((e) => ({
        id: e.id,
        imageUrl: getPublicImageUrl(e)!,
        reactionCount: (e as any).reactions?.length || 0,
      }))
      .sort((a, b) => b.reactionCount - a.reactionCount)
      .slice(0, 9);
  }, [activityEntries, planActivityIds, failedImages]);

  return (
    <div
      className={`h-full flex flex-col overflow-y-auto bg-gradient-to-br ${gradient}`}
    >
      {/* Header area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-12 shrink-0">
        {/* Central emoji */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="text-7xl mb-4"
        >
          {plan.emoji || "🎯"}
        </motion.div>

        {/* Plan goal */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-2xl font-bold text-white text-center mb-4 px-4 leading-tight"
        >
          {plan.goal}
        </motion.h2>

        {/* Badge + streak */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
            <span className="text-sm">{badgeEmoji}</span>
            <span className="text-white text-sm font-medium">{badgeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
            <span className="text-sm">🔥</span>
            <span className="text-white text-sm font-bold">{streak}</span>
            <span className="text-white/70 text-xs">weeks</span>
          </div>
        </motion.div>
      </div>

      {/* Photo grid */}
      {topPhotos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="px-4 pb-6 shrink-0"
        >
          <div
            className={`grid gap-1.5 ${
              topPhotos.length <= 3
                ? "grid-cols-3"
                : topPhotos.length <= 6
                ? "grid-cols-3"
                : "grid-cols-3"
            }`}
          >
            {topPhotos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                className="aspect-square rounded-lg overflow-hidden ring-1 ring-white/20"
              >
                <img
                  src={photo.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(photo.id)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PlanBreakdownStory;
