import React, { createContext, useMemo, useState } from "react";
import { startOfWeek } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useLogError } from "@/hooks/useLogError";
import { usePlans } from "../plans";
import { type AchievementsContextType, type CelebrationData, type CreateAchievementPostData } from "./types";

export const AchievementsContext = createContext<
  AchievementsContextType | undefined
>(undefined);

export const AchievementsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { plans, upsertPlan } = usePlans();
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const { handleQueryError } = useLogError();
  const [celebrationToShow, setCelebrationToShow] =
    useState<CelebrationData | null>(null);

  // Detect uncelebrated achievements
  useMemo(() => {
    if (!plans) return;

    // Get the start of the current week (Monday)
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Check all active plans for uncelebrated achievements
    for (const plan of plans) {
      if (!plan.progress) continue;

      const progress = plan.progress;

      console.log("progress", progress);

      // Check streak achievement
      if (
        progress.achievement?.achievedLastStreakAt &&
        (!progress.achievement?.celebratedStreakAt ||
          new Date(progress.achievement.achievedLastStreakAt) >
            new Date(progress.achievement.celebratedStreakAt))
      ) {
        // Only show if the achievement was achieved this week
        const achievedDate = new Date(progress.achievement.achievedLastStreakAt);
        if (achievedDate >= currentWeekStart) {
          setCelebrationToShow({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "streak",
            streakNumber: progress.achievement.streak,
          });
          return;
        }
      }

      // Check habit achievement (4 weeks = 28 days)
      if (
        progress.habitAchievement?.achievedAt &&
        (!progress.habitAchievement?.celebratedAt ||
          new Date(progress.habitAchievement.achievedAt) >
            new Date(progress.habitAchievement.celebratedAt))
      ) {
        // Only show if the achievement was achieved this week
        const achievedDate = new Date(progress.habitAchievement.achievedAt);
        if (achievedDate >= currentWeekStart) {
          setCelebrationToShow({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "habit",
          });
          return;
        }
      }

      // Check lifestyle achievement (9 weeks = 63 days)
      if (
        progress.lifestyleAchievement?.achievedAt &&
        (!progress.lifestyleAchievement?.celebratedAt ||
          new Date(progress.lifestyleAchievement.achievedAt) >
            new Date(progress.lifestyleAchievement.celebratedAt))
      ) {
        // Only show if the achievement was achieved this week
        const achievedDate = new Date(progress.lifestyleAchievement.achievedAt);
        if (achievedDate >= currentWeekStart) {
          setCelebrationToShow({
            planId: plan.id,
            planEmoji: plan.emoji || "🎯",
            planGoal: plan.goal,
            achievementType: "lifestyle",
          });
          return;
        }
      }
    }
  }, [plans]);

  const markAchievementAsCelebrated = async (achievementData: {
    planId: string;
    achievementType: "streak" | "habit" | "lifestyle";
  }) => {
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
    await markAchievementAsCelebrated(celebrationToShow);
    setCelebrationToShow(null);
  };

  const dismissCelebration = () => {
    setCelebrationToShow(null);
  };

  const createAchievementPostMutation = useMutation({
    mutationFn: async (data: CreateAchievementPostData) => {
      const formData = new FormData();
      formData.append("planId", data.planId);
      formData.append("achievementType", data.achievementType.toUpperCase());
      if (data.streakNumber) {
        formData.append("streakNumber", data.streakNumber.toString());
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

  const context: AchievementsContextType = {
    celebrationToShow,
    handleCelebrationClose,
    markAchievementAsCelebrated,
    dismissCelebration,
    createAchievementPost,
    isCreatingAchievementPost: createAchievementPostMutation.isPending,
  };

  return (
    <AchievementsContext.Provider value={context}>
      {children}
    </AchievementsContext.Provider>
  );
};
