import { useContext } from "react";
import { AchievementsContext } from "./provider";

export const useAchievements = () => {
  const context = useContext(AchievementsContext);
  if (context === undefined) {
    throw new Error(
      "useAchievements must be used within an AchievementsProvider"
    );
  }
  return context;
};
