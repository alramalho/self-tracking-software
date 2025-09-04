import {
  generateAndStoreRandomColor,
  getStoredRandomColor,
  useRandomColorCountdown,
} from "@/hooks/useThemeColors";
import {
  BaseLoweredThemeColor,
  getThemeVariants,
  LowerThemeColor
} from "@/utils/theme";
import { ThemeColor } from "@tsw/prisma";
import React, { createContext, useContext, useMemo } from "react";
import toast from "react-hot-toast";
import { useCurrentUser } from "./users";

interface ThemeContextType {
  currentTheme: LowerThemeColor;
  effectiveTheme: BaseLoweredThemeColor;
  updateTheme: (color: LowerThemeColor) => Promise<void>;
  getThemeClass: (
    type: "primary" | "secondary" | "accent" | "hover" | "border" | "background"
  ) => string;
  getTextClass: () => string;
  randomTimeLeft?: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Utility to get computed color from a Tailwind class
// const getComputedColor = (className: string): string => {
//   // Create a temporary element
//   const temp = document.createElement("div");
//   temp.className = className;
//   document.body.appendChild(temp);

//   // Get the computed background color
//   const computedColor = window.getComputedStyle(temp).backgroundColor;

//   // Clean up
//   document.body.removeChild(temp);
//   return computedColor;
// };

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

  // useEffect(() => {
  //   // Set CSS variables
  //   const root = document.documentElement;
  //   Object.entries(themeVariants.cssVars).forEach(([key, className]) => {
  //     const computedColor = getComputedColor(className);
  //     root.style.setProperty(`--${key}`, computedColor);
  //   });
  // }, [effectiveTheme, themeVariants]);

  const getThemeClass = (
    type: "primary" | "secondary" | "accent" | "hover" | "border" | "background"
  ) => {
    return themeVariants[type];
  };

  const getTextClass = () => {
    return themeVariants.text;
  };

  const value = {
    currentTheme: userTheme,
    effectiveTheme,
    updateTheme: async (color: LowerThemeColor) => {
      await updateUser({
        updates: { themeBaseColor: color.toUpperCase() as ThemeColor },
        muteNotifications: true,
      });
      toast.success("Theme updated successfully");
    },
    getThemeClass,
    getTextClass,
    randomTimeLeft: userTheme === "random" ? randomTimeLeft : undefined,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
