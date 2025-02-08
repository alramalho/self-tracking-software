import { useUserPlan } from "@/contexts/UserPlanContext";
import { getThemeConfig, ThemeConfig } from "@/utils/theme";

export const useThemeColors = (): ThemeConfig => {
  const { currentTheme } = useUserPlan();
  return getThemeConfig(currentTheme);
};

export const useThemeColor = (): string => {
  const { currentTheme } = useUserPlan();
  return currentTheme;
};
