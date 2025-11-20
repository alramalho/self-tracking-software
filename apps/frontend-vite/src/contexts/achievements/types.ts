import { type AchievementType } from "@/components/AchievementCelebrationPopover";

export interface CelebrationData {
  planId: string;
  planEmoji: string;
  planGoal: string;
  achievementType: AchievementType;
  streakNumber?: number;
}

export interface CreateAchievementPostData {
  planId: string;
  achievementType: AchievementType;
  streakNumber?: number;
  message?: string;
  photos?: File[];
}

export interface AchievementsContextType {
  celebrationToShow: CelebrationData | null;
  handleCelebrationClose: () => Promise<void>;
  markAchievementAsCelebrated: (achievementData: {
    planId: string;
    achievementType: AchievementType;
  }) => Promise<void>;
  dismissCelebration: () => void;
  createAchievementPost: (data: CreateAchievementPostData) => Promise<void>;
  isCreatingAchievementPost: boolean;
  isMarkingAsCelebrated: boolean;
}
