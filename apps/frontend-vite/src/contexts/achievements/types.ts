import { type AchievementType } from "@/components/AchievementCelebrationPopover";

export interface CelebrationData {
  planId?: string; // Optional for level_up achievements
  planEmoji: string;
  planGoal: string;
  achievementType: AchievementType;
  streakNumber?: number;
  levelName?: string; // For level_up achievements
  levelThreshold?: number; // For marking as celebrated
}

export interface CreateAchievementPostData {
  planId?: string; // Optional for level_up achievements
  achievementType: AchievementType;
  streakNumber?: number;
  levelName?: string; // For level_up achievements
  message?: string;
  photos?: File[];
}

export interface AchievementsContextType {
  celebrationToShow: CelebrationData | null;
  handleCelebrationClose: () => Promise<void>;
  markAchievementAsCelebrated: (achievementData: {
    planId?: string;
    achievementType: AchievementType;
    levelThreshold?: number; // For level_up achievements
  }) => Promise<void>;
  dismissCelebration: () => void;
  createAchievementPost: (data: CreateAchievementPostData) => Promise<void>;
  isCreatingAchievementPost: boolean;
  isMarkingAsCelebrated: boolean;
}
