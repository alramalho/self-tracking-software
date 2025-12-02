import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import { startOfWeek } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { usePlans } from "../plans";
import { useCurrentUser } from "../users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { type AchievementsContextType, type CelebrationData, type CreateAchievementPostData, type UpdateAchievementPostData } from "./types";

export const AchievementsContext = createContext<
  AchievementsContextType | undefined
>(undefined);

export const AchievementsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { plans, upsertPlan } = usePlans();
  const { currentUser } = useCurrentUser();
  const accountLevel = useAccountLevel();
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const { handleQueryError } = useLogError();
  const [celebrationToShow, setCelebrationToShow] =
    useState<CelebrationData | null>(null);
  const [celebrationsQueue, setCelebrationsQueue] = useState<CelebrationData[]>([]);
  const [isMarkingAsCelebrated, setIsMarkingAsCelebrated] = useState(false);

  // Track if we've already processed level-ups to avoid duplicates
  const processedLevelThreshold = useRef<number | null>(null);

  // Detect uncelebrated plan achievements
  const planCelebrations = useMemo(() => {
    if (!plans) return [];

    const celebrations: CelebrationData[] = [];
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    for (const plan of plans) {
      if (!plan.progress) continue;

      const progress = plan.progress;

      // Check streak achievement
      if (
        progress.achievement?.achievedLastStreakAt &&
        (!progress.achievement?.celebratedStreakAt ||
          new Date(progress.achievement.achievedLastStreakAt) >
            new Date(progress.achievement.celebratedStreakAt))
      ) {
        const achievedDate = new Date(progress.achievement.achievedLastStreakAt);
        if (achievedDate >= currentWeekStart) {
          celebrations.push({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "streak",
            streakNumber: progress.achievement.streak,
          });
        }
      }

      // Check habit achievement
      if (
        progress.habitAchievement?.achievedAt &&
        (!progress.habitAchievement?.celebratedAt ||
          new Date(progress.habitAchievement.achievedAt) >
            new Date(progress.habitAchievement.celebratedAt))
      ) {
        const achievedDate = new Date(progress.habitAchievement.achievedAt);
        if (achievedDate >= currentWeekStart) {
          celebrations.push({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "habit",
          });
        }
      }

      // Check lifestyle achievement
      if (
        progress.lifestyleAchievement?.achievedAt &&
        (!progress.lifestyleAchievement?.celebratedAt ||
          new Date(progress.lifestyleAchievement.achievedAt) >
            new Date(progress.lifestyleAchievement.celebratedAt))
      ) {
        const achievedDate = new Date(progress.lifestyleAchievement.achievedAt);
        if (achievedDate >= currentWeekStart) {
          celebrations.push({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "lifestyle",
          });
        }
      }
    }

    return celebrations;
  }, [plans]);

  // Detect uncelebrated level-ups (only current level, not intermediate ones)
  const levelUpCelebrations = useMemo(() => {
    if (!currentUser || !accountLevel.currentLevel) return [];

    const celebratedThreshold = currentUser.celebratedLevelThreshold ?? 0;
    const currentLevel = accountLevel.currentLevel;

    // Only celebrate if current level hasn't been celebrated yet
    if (currentLevel.threshold > celebratedThreshold) {
      // Avoid re-processing if we already processed this threshold
      if (processedLevelThreshold.current === currentLevel.threshold) {
        return [];
      }

      // Only celebrate the current level, not intermediate ones
      // (e.g., if user is Gold but never celebrated, only show Gold - not Bronze & Silver too)
      return [{
        planEmoji: "🎖️",
        planGoal: `You've reached ${currentLevel.name} level!`,
        achievementType: "level_up" as const,
        levelName: currentLevel.name,
        levelThreshold: currentLevel.threshold,
      }];
    }

    return [];
  }, [currentUser, accountLevel.currentLevel]);

  // Combine and queue all celebrations
  useEffect(() => {
    const allCelebrations = [...planCelebrations, ...levelUpCelebrations];

    if (allCelebrations.length > 0 && !celebrationToShow && celebrationsQueue.length === 0) {
      // Mark level-ups as processed to avoid duplicates
      const levelUps = allCelebrations.filter(c => c.achievementType === "level_up");
      if (levelUps.length > 0) {
        const maxThreshold = Math.max(...levelUps.map(c => c.levelThreshold ?? 0));
        processedLevelThreshold.current = maxThreshold;
      }

      // Show first celebration, queue the rest
      setCelebrationToShow(allCelebrations[0]);
      if (allCelebrations.length > 1) {
        setCelebrationsQueue(allCelebrations.slice(1));
      }
    }
  }, [planCelebrations, levelUpCelebrations, celebrationToShow, celebrationsQueue.length]);

  const markAchievementAsCelebrated = async (achievementData: {
    planId?: string;
    achievementType: "streak" | "habit" | "lifestyle" | "level_up";
    levelThreshold?: number;
  }) => {
    // Handle level_up achievements
    if (achievementData.achievementType === "level_up" && achievementData.levelThreshold) {
      await api.post("/achievements/mark-level-celebrated", {
        levelThreshold: achievementData.levelThreshold,
      });
      // Update the current user cache
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      return;
    }

    // Handle plan-based achievements
    if (!achievementData.planId) return;

    const plan = plans?.find((p) => p.id === achievementData.planId);
    if (!plan?.progress) return;

    // Update the appropriate celebratedAt field in progressState
    const now = new Date();
    const updatedProgressState = { ...plan.progress };

    if (achievementData.achievementType === "streak") {
      updatedProgressState.achievement = {
        ...updatedProgressState.achievement,
        celebratedStreakAt: now,
      };
    } else if (achievementData.achievementType === "habit") {
      updatedProgressState.habitAchievement = {
        ...updatedProgressState.habitAchievement,
        celebratedAt: now,
      };
    } else if (achievementData.achievementType === "lifestyle") {
      updatedProgressState.lifestyleAchievement = {
        ...updatedProgressState.lifestyleAchievement,
        celebratedAt: now,
      };
    }

    // Update the plan's progressState via the backend
    await upsertPlan({
      planId: achievementData.planId,
      updates: {
        progressState: updatedProgressState as any,
      },
      muteNotifications: true,
    });
  };

  const handleCelebrationClose = async () => {
    if (!celebrationToShow) return;
    setIsMarkingAsCelebrated(true);
    try {
      await markAchievementAsCelebrated({
        planId: celebrationToShow.planId,
        achievementType: celebrationToShow.achievementType,
        levelThreshold: celebrationToShow.levelThreshold,
      });

      // Process the next celebration in queue
      if (celebrationsQueue.length > 0) {
        const [next, ...rest] = celebrationsQueue;
        setCelebrationToShow(next);
        setCelebrationsQueue(rest);
      } else {
        setCelebrationToShow(null);
      }
    } finally {
      setIsMarkingAsCelebrated(false);
    }
  };

  const dismissCelebration = () => {
    // Process the next celebration in queue
    if (celebrationsQueue.length > 0) {
      const [next, ...rest] = celebrationsQueue;
      setCelebrationToShow(next);
      setCelebrationsQueue(rest);
    } else {
      setCelebrationToShow(null);
    }
  };

  const createAchievementPostMutation = useMutation({
    mutationFn: async (data: CreateAchievementPostData) => {
      const formData = new FormData();
      if (data.planId) {
        formData.append("planId", data.planId);
      }
      formData.append("achievementType", data.achievementType.toUpperCase());
      if (data.streakNumber) {
        formData.append("streakNumber", data.streakNumber.toString());
      }
      if (data.levelName) {
        formData.append("levelName", data.levelName);
      }
      if (data.message?.trim()) {
        formData.append("message", data.message.trim());
      }

      // Append all photos
      data.photos?.forEach((photo) => {
        formData.append("photos", photo);
      });

      const response = await api.post("/achievements/create", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      toast.success("Achievement shared with your connections! 🎉");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to share achievement");
      toast.error("Failed to share achievement. Please try again.");
    },
  });

  const createAchievementPost = async (data: CreateAchievementPostData) => {
    return createAchievementPostMutation.mutateAsync(data);
  };

  const updateAchievementPostMutation = useMutation({
    mutationFn: async (data: UpdateAchievementPostData) => {
      const response = await api.patch(`/achievements/${data.achievementPostId}`, {
        message: data.message,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Achievement updated!");
    },
    onError: (error) => {
      handleQueryError(error, "Failed to update achievement");
      toast.error("Failed to update achievement. Please try again.");
    },
  });

  const updateAchievementPost = async (data: UpdateAchievementPostData) => {
    return updateAchievementPostMutation.mutateAsync(data);
  };

  const context: AchievementsContextType = {
    celebrationToShow,
    handleCelebrationClose,
    markAchievementAsCelebrated,
    dismissCelebration,
    createAchievementPost,
    updateAchievementPost,
    isCreatingAchievementPost: createAchievementPostMutation.isPending,
    isUpdatingAchievementPost: updateAchievementPostMutation.isPending,
    isMarkingAsCelebrated,
  };

  return (
    <AchievementsContext.Provider value={context}>
      {children}
    </AchievementsContext.Provider>
  );
};
