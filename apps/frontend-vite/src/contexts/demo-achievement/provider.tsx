import { AchievementCelebrationPopover, type AchievementType } from '@/components/AchievementCelebrationPopover';
import { AchievementShareDialog } from '@/components/AchievementShareDialog';
import { usePlans } from '@/contexts/plans';
import { isAfter } from 'date-fns';
import React, { useState, useMemo } from 'react';
import { DemoAchievementContext, type DemoAchievementContextType } from './types';

export const DemoAchievementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoAchievementType, setDemoAchievementType] = useState<DemoAchievementContextType['demoAchievementType']>(null);
  const [shareDialogData, setShareDialogData] = useState<{
    planId?: string;
    planEmoji: string;
    planGoal: string;
    achievementType: AchievementType;
    streakNumber?: number;
    levelName?: string;
  } | null>(null);

  const { plans } = usePlans();

  // Get the first active plan from the user
  const firstActivePlan = useMemo(() => {
    return plans?.find(
      (plan) =>
        plan.deletedAt === null &&
        (plan.finishingDate === null || isAfter(plan.finishingDate, new Date()))
    );
  }, [plans]);

  // Fallback to demo data if no active plan exists
  const demoPlanData = useMemo(() => ({
    planId: firstActivePlan?.id || "demo-plan-id",
    planEmoji: firstActivePlan?.emoji || "💪",
    planGoal: firstActivePlan?.goal || "Exercise 3x per week",
  }), [firstActivePlan]);

  const context: DemoAchievementContextType = {
    demoAchievementType,
    setDemoAchievementType,
  };

  const isLevelUp = demoAchievementType === "level_up";

  const handleCelebrationShare = () => {
    if (!demoAchievementType) return;
    // Transfer celebration data to share dialog
    setShareDialogData({
      planId: isLevelUp ? undefined : demoPlanData.planId,
      planEmoji: isLevelUp ? "🎖️" : demoPlanData.planEmoji,
      planGoal: isLevelUp ? "You've reached Gold level!" : demoPlanData.planGoal,
      achievementType: demoAchievementType,
      streakNumber: demoAchievementType === "streak" ? 5 : undefined,
      levelName: isLevelUp ? "Gold" : undefined,
    });
    setDemoAchievementType(null);
  };

  const handleShareDialogClose = () => {
    setShareDialogData(null);
  };

  return (
    <DemoAchievementContext.Provider value={context}>
      {children}
      {demoAchievementType && (
        <AchievementCelebrationPopover
          open={true}
          onClose={() => setDemoAchievementType(null)}
          onShare={handleCelebrationShare}
          achievementType={demoAchievementType}
          planEmoji={isLevelUp ? "🎖️" : demoPlanData.planEmoji}
          planGoal={isLevelUp ? "You've reached Gold level!" : demoPlanData.planGoal}
          streakNumber={demoAchievementType === "streak" ? 5 : undefined}
          levelName={isLevelUp ? "Gold" : undefined}
        />
      )}
      {shareDialogData && (
        <AchievementShareDialog
          open={true}
          onClose={handleShareDialogClose}
          planId={shareDialogData.planId}
          planEmoji={shareDialogData.planEmoji}
          planGoal={shareDialogData.planGoal}
          achievementType={shareDialogData.achievementType}
          streakNumber={shareDialogData.streakNumber}
          levelName={shareDialogData.levelName}
        />
      )}
    </DemoAchievementContext.Provider>
  );
};
