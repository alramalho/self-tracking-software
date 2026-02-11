import { useTheme } from "@/contexts/theme/useTheme";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [selectedPhoto, setSelectedPhoto] = useState<{
    entry: ActivityEntry;
    activity: Activity;
    imageUrl: string;
  } | null>(null);

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

  const activitiesById = useMemo(() => {
    return new Map(plan.activities.map((a) => [a.id, a]));
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
        entry: e,
        activity: activitiesById.get(e.activityId!)!,
      }))
      .sort((a, b) => b.reactionCount - a.reactionCount)
      .slice(0, 9);
  }, [activityEntries, planActivityIds, failedImages, activitiesById]);

  return (
    <div
      className={`h-full flex flex-col overflow-y-auto relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`, backgroundSize: "24px 24px" }} />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-3xl" style={{ background: isLightMode ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.07)" }} />

      {/* Header area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-12 shrink-0 relative z-10">
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
          className={`text-2xl font-zalando-expanded-black font-black italic text-center mb-4 px-4 leading-tight ${isLightMode ? "text-neutral-900" : "text-white"}`}
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
          <div className={`flex items-center gap-1.5 px-4 py-1.5 ${isLightMode ? "bg-neutral-100" : "bg-white/10"} backdrop-blur-sm rounded-full`}>
            <span className="text-sm">{badgeEmoji}</span>
            <span className={`text-sm font-medium ${isLightMode ? "text-neutral-700" : "text-white"}`}>{badgeLabel}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-4 py-1.5 ${isLightMode ? "bg-neutral-100" : "bg-white/10"} backdrop-blur-sm rounded-full`}>
            <span className="text-sm">🔥</span>
            <span className={`text-sm font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>{streak}</span>
            <span className={`text-xs ${isLightMode ? "text-neutral-400" : "text-white/70"}`}>weeks</span>
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
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.3, delay: 0.5 + idx * 0.05 }}
                className="aspect-square rounded-lg overflow-hidden ring-1 ring-white/20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhoto({ entry: photo.entry, activity: photo.activity, imageUrl: photo.imageUrl });
                }}
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

      {/* Expanded photo dialog */}
      <Dialog
        open={!!selectedPhoto}
        onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}
      >
        <DialogContent
          className="p-0 border-none bg-transparent shadow-none max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle className="sr-only">Activity details</DialogTitle>
          {selectedPhoto && (() => {
            const { entry, activity, imageUrl } = selectedPhoto;
            const reactions = (entry as any).reactions as Array<{ emoji: string; user: { username: string } }> | undefined;
            const comments = (entry as any).comments as Array<{ text: string; user: { username: string; picture: string } }> | undefined;
            const reactionCounts = reactions?.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {});

            return (
              <div className="rounded-2xl overflow-hidden bg-card">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full max-h-[60vh] object-cover"
                />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{activity.emoji}</span>
                    <div>
                      <p className="font-semibold text-foreground">
                        {activity.title} – {entry.quantity} {activity.measure}
                      </p>
                      {entry.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {reactionCounts && Object.keys(reactionCounts).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-sm"
                        >
                          <span>{emoji}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {comments && comments.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      {comments.map((c, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <img
                            src={c.user.picture}
                            alt=""
                            className="w-5 h-5 rounded-full mt-0.5 shrink-0"
                          />
                          <p className="text-sm text-foreground">
                            <span className="font-medium text-muted-foreground">
                              @{c.user.username}
                            </span>{" "}
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanBreakdownStory;
