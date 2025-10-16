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
import React, { useEffect, useMemo } from "react";
import { useCurrentUser } from "../users";
import { type LowerThemeMode, updateUserTheme, updateUserThemeMode } from "./service";
import { ThemeContext, type ThemeContextType } from "./types";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, updateUser } = useCurrentUser();
  const userTheme = useMemo(
    () => currentUser?.themeBaseColor?.toLowerCase() as LowerThemeColor,
    [currentUser?.themeBaseColor]
  );

  const themeMode = useMemo(
    () => (currentUser?.themeMode?.toLowerCase() || "light") as LowerThemeMode,
    [currentUser?.themeMode]
  );

  // Detect system preference for AUTO mode
  const systemPrefersDark = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  // Calculate effective theme mode (resolve AUTO to light/dark)
  const effectiveThemeMode = useMemo<"light" | "dark">(() => {
    if (themeMode === "auto") {
      return systemPrefersDark ? "dark" : "light";
    }
    return themeMode as "light" | "dark";
  }, [themeMode, systemPrefersDark]);

  // Apply dark class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveThemeMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [effectiveThemeMode]);

  // Get the effective theme color (either user's choice or resolved random color)
  const effectiveTheme = useMemo<BaseLoweredThemeColor>(() => {
    if (!currentUser) return "blue";

    if (currentUser?.themeBaseColor?.toLowerCase() !== "random")
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
    themeMode,
    effectiveThemeMode,
    isLightMode: themeMode === "light",
    isDarkMode: themeMode === "dark",
    updateTheme: async (color: LowerThemeColor) => {
      await updateUserTheme(updateUser, color);
    },
    updateThemeMode: async (mode: LowerThemeMode) => {
      await updateUserThemeMode(updateUser, mode);
    },
    getThemeClass,
    getTextClass,
    randomTimeLeft: userTheme === "random" ? randomTimeLeft : undefined,
  };

  return (
    <ThemeContext.Provider value={context}>{children}</ThemeContext.Provider>
  );
};
