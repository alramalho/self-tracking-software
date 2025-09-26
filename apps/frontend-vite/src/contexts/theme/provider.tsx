import {
  generateAndStoreRandomColor,
  getStoredRandomColor,
  useRandomColorCountdown,
} from "@/hooks/useThemeColors";
import {
  type BaseLoweredThemeColor,
  getThemeVariants,
  type LowerThemeColor,
} from "@/utils/theme";
import React, { useMemo } from "react";
import { useCurrentUser } from "../users";
import { updateUserTheme } from "./service";
import { ThemeContext, type ThemeContextType } from "./types";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, updateUser } = useCurrentUser();
  const userTheme =
    currentUser?.themeBaseColor.toLowerCase() as LowerThemeColor;

  // Get the effective theme color (either user's choice or resolved random color)
  const effectiveTheme = useMemo<BaseLoweredThemeColor>(() => {
    if (!currentUser) return "blue";

    if (currentUser?.themeBaseColor.toLowerCase() !== "random")
      return userTheme as BaseLoweredThemeColor;

    const storedRandom = getStoredRandomColor();
    if (storedRandom) return storedRandom.color;

    return generateAndStoreRandomColor();
  }, [userTheme, currentUser?.themeBaseColor]);

  // Get countdown for random theme
  const randomTimeLeft = useRandomColorCountdown(
    userTheme === "random" ? getStoredRandomColor()?.expiresAt || null : null
  );

  const themeVariants = getThemeVariants(effectiveTheme);

  const getThemeClass = (
    type: "primary" | "secondary" | "accent" | "hover" | "border" | "background"
  ) => {
    return themeVariants[type];
  };

  const getTextClass = () => {
    return themeVariants.text;
  };

  const context: ThemeContextType = {
    currentTheme: userTheme,
    effectiveTheme,
    updateTheme: async (color: LowerThemeColor) => {
      await updateUserTheme(updateUser, color);
    },
    getThemeClass,
    getTextClass,
    randomTimeLeft: userTheme === "random" ? randomTimeLeft : undefined,
  };

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  );
};
