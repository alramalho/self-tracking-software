import { useTheme } from "@/contexts/ThemeContext";
import {
  BaseLoweredThemeColor as BaseThemeColor,
  getThemeVariants,
  ThemeVariants,
} from "@/utils/theme";
import { addDays, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

interface RandomColorState {
  color: BaseThemeColor;
  expiresAt: string;
}

export const useThemeColors = (): ThemeVariants => {
  const { effectiveTheme } = useTheme();
  const variants = getThemeVariants(effectiveTheme);
  return {
    ...variants,
    raw: effectiveTheme, // This ensures we're using the effective theme color
  };
};

export const getStoredRandomColor = (): RandomColorState | null => {
  try {
    const stored = localStorage.getItem("randomColorState");
    if (!stored) return null;

    const state = JSON.parse(stored) as RandomColorState;
    if (new Date(state.expiresAt) <= new Date()) return null;

    return state;
  } catch {
    return null;
  }
};

export const generateAndStoreRandomColor = (): BaseThemeColor => {
  const colors: BaseThemeColor[] = [
    "slate",
    "blue",
    "violet",
    "amber",
    "emerald",
    "rose",
  ];
  const randomIndex = Math.floor(Math.random() * colors.length);
  const newState: RandomColorState = {
    color: colors[randomIndex],
    expiresAt: addDays(new Date(), 3).toISOString(),
  };

  localStorage.setItem("randomColorState", JSON.stringify(newState));
  return newState.color;
};

export const getTimeLeftString = (expiresAt: string): string => {
  const expDate = new Date(expiresAt);
  if (expDate <= new Date()) return "";
  return `new color in ${formatDistanceToNow(expDate)}!`;
};

// This hook now only manages the UI update for the countdown
export const useRandomColorCountdown = (expiresAt: string | null) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimeLeft = () => {
      setTimeLeft(getTimeLeftString(expiresAt));
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000 * 60); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  return timeLeft;
};
