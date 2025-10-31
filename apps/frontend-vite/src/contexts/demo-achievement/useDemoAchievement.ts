import { useContext } from "react";
import { DemoAchievementContext } from "./types";

export const useDemoAchievement = () => {
  const context = useContext(DemoAchievementContext);
  if (context === undefined) {
    throw new Error('useDemoAchievement must be used within a DemoAchievementProvider');
  }
  return context;
};
