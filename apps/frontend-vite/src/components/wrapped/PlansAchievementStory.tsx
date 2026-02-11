import { useTheme } from "@/contexts/theme/useTheme";
import type { ActivityEntry, Activity } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import React, { useMemo, useState, useCallback } from "react";

interface PlanData {
  id: string;
  emoji: string | null;
  goal: string;
  progress: PlanProgressData;
  activities: Activity[];
}

interface PlansAchievementStoryProps {
  year: number;
  plans: PlanData[];
  activityEntries: ActivityEntry[];
}

type AchievementTier = "lifestyle" | "habit" | "none";

function getTier(plan: PlanData): AchievementTier {
  if (plan.progress?.lifestyleAchievement?.isAchieved) return "lifestyle";
  if (plan.progress?.habitAchievement?.isAchieved) return "habit";
  return "none";
}

function getStreak(plan: PlanData): number {
  return plan.progress?.achievement?.streak || 0;
}

const tierOrder: Record<AchievementTier, number> = { lifestyle: 0, habit: 1, none: 2 };

const getPublicImageUrl = (entry: ActivityEntry): string | null => {
  if (entry.imageS3Path) {
    return `https://tracking-software-bucket-production.s3.eu-central-1.amazonaws.com/${entry.imageS3Path}`;
  }
  return entry.imageUrl || null;
};

export const PlansAchievementStory: React.FC<PlansAchievementStoryProps> = ({
  year,
  plans,
  activityEntries,
}) => {
  const { isLightMode } = useTheme();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((entryId: string) => {
    setFailedImages((prev) => new Set(prev).add(entryId));
  }, []);

  const ranked = useMemo(() => {
    return [...plans]
      .filter((p) => p.progress)
      .sort((a, b) => {
        const tierDiff = tierOrder[getTier(a)] - tierOrder[getTier(b)];
        if (tierDiff !== 0) return tierDiff;
        return getStreak(b) - getStreak(a);
      });
  }, [plans]);

  // Best photos across all plans
  const topPhotos = useMemo(() => {
    const allPlanActivityIds = new Set(plans.flatMap((p) => p.activities.map((a) => a.id)));
    const yearEntries = activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year && e.activityId && allPlanActivityIds.has(e.activityId)
    );
    return yearEntries
      .filter((e) => {
        const url = getPublicImageUrl(e);
        return url && !failedImages.has(e.id);
      })
      .map((e) => ({
        id: e.id,
        imageUrl: getPublicImageUrl(e)!,
        reactionCount: (e as any).reactions?.length || 0,
      }))
      .sort((a, b) => b.reactionCount - a.reactionCount)
      .slice(0, 5);
  }, [activityEntries, plans, year, failedImages]);

  if (ranked.length === 0) return null;

  const podium = ranked.slice(0, 3);
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

  const tierBadge = (tier: AchievementTier) => {
    if (tier === "lifestyle") return { emoji: "🚀", label: "Lifestyle" };
    if (tier === "habit") return { emoji: "🌱", label: "Habit" };
    return null;
  };

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
      <div className={`absolute top-[5%] left-[-10%] w-[50%] h-[50%] rounded-full blur-3xl ${isLightMode ? "bg-violet-200/30" : "bg-violet-900/15"}`} />
      <div className={`absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-fuchsia-200/25" : "bg-fuchsia-900/10"}`} />

      {/* Header */}
      <div className="p-6 pt-12 shrink-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-zalando-expanded-black font-black italic"
        >
          <h2 className={`text-3xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>
            {year}'s plans
          </h2>
        </motion.div>
      </div>

      <div className="px-6 relative z-10 flex-1 flex flex-col">
        {/* Emoji podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-end justify-center gap-3 mb-6"
        >
          {podiumDisplay.map((plan, idx) => {
            const height = podiumHeights[idx];
            const isFirst = plan === podium[0];
            const tier = getTier(plan);
            return (
              <motion.div
                key={plan.id}
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
                    ? tier === "lifestyle"
                      ? isLightMode ? "bg-violet-100/80 ring-1 ring-violet-200" : "bg-violet-500/15 ring-1 ring-violet-500/30"
                      : isLightMode ? "bg-emerald-100/80 ring-1 ring-emerald-200" : "bg-emerald-500/15 ring-1 ring-emerald-500/30"
                    : isLightMode
                      ? "bg-neutral-100/80 ring-1 ring-neutral-200/50"
                      : "bg-white/5 ring-1 ring-white/10"
                }`}
              >
                <span className="text-4xl mb-1">{plan.emoji || "🎯"}</span>
                <span className={`text-xs font-mono font-bold ${
                  isFirst
                    ? tier === "lifestyle"
                      ? "text-violet-500"
                      : "text-emerald-500"
                    : isLightMode ? "text-neutral-400" : "text-white/40"
                }`}>
                  {ranked.indexOf(plan) + 1}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Full list */}
        <div className="space-y-2 pb-4">
          {ranked.map((plan, idx) => {
            const tier = getTier(plan);
            const streak = getStreak(plan);
            const badge = tierBadge(tier);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.7 + idx * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${isLightMode ? "bg-neutral-50/60" : "bg-white/5"}`}
              >
                <span className={`text-sm font-mono w-6 text-center ${isLightMode ? "text-neutral-400" : "text-white/40"}`}>
                  {idx + 1}
                </span>
                <span className="text-xl">{plan.emoji || "🎯"}</span>
                <div className={`flex-1 min-w-0 text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}>
                  <div className="truncate">{plan.goal}</div>
                  {badge && (
                    <div className={`text-xs ${tier === "lifestyle" ? (isLightMode ? "text-violet-500" : "text-violet-400") : (isLightMode ? "text-emerald-500" : "text-emerald-400")}`}>
                      {badge.emoji} {badge.label}
                    </div>
                  )}
                </div>
                {streak > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Flame size={14} className={isLightMode ? "text-orange-500" : "text-orange-400"} />
                    <span className={`text-sm font-mono font-semibold ${isLightMode ? "text-orange-600" : "text-orange-400"}`}>
                      {streak}
                    </span>
                    <span className={`text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>
                      wks
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Photo strip */}
        {topPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="pb-6"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {topPhotos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 1.0 + idx * 0.05 }}
                  className="w-20 h-20 shrink-0 rounded-xl overflow-hidden ring-1 ring-white/20"
                >
                  <img
                    src={photo.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => handleImageError(photo.id)}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PlansAchievementStory;
