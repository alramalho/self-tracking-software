import { useUserPlan } from "@/contexts/UserPlanContext";
import { getThemeVariants, ThemeVariants } from "@/utils/theme";

export const useThemeColors = (): ThemeVariants => {
  const { currentTheme } = useUserPlan();
  return getThemeVariants(currentTheme);
};

export const useThemeColor = (): string => {
  const { currentTheme } = useUserPlan();
  return currentTheme;
};
