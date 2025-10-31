import { AchievementCelebrationPopover } from '@/components/AchievementCelebrationPopover';
import React, { useState } from 'react';
import { DemoAchievementContext, type DemoAchievementContextType } from './types';

export const DemoAchievementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoAchievementType, setDemoAchievementType] = useState<DemoAchievementContextType['demoAchievementType']>(null);

  const context: DemoAchievementContextType = {
    demoAchievementType,
    setDemoAchievementType,
  };

  return (
    <DemoAchievementContext.Provider value={context}>
      {children}
      {demoAchievementType && (
        <AchievementCelebrationPopover
          open={true}
          onClose={() => setDemoAchievementType(null)}
          achievementType={demoAchievementType}
          planEmoji="💪"
          planGoal="Exercise 3x per week"
          streakNumber={demoAchievementType === "streak" ? 5 : undefined}
        />
      )}
    </DemoAchievementContext.Provider>
  );
};
