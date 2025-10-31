import { createContext } from "react";
import type { AchievementType } from "@/components/AchievementCelebrationPopover";

export interface DemoAchievementContextType {
  demoAchievementType: AchievementType | null;
  setDemoAchievementType: (type: AchievementType | null) => void;
}

export const DemoAchievementContext = createContext<DemoAchievementContextType | undefined>(undefined);
