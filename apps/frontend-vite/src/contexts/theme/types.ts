import {
  type BaseLoweredThemeColor,
  type LowerThemeColor,
} from "@/utils/theme";
import { createContext } from "react";
import type { LowerThemeMode } from "./service";

export interface ThemeContextType {
  currentTheme: LowerThemeColor;
  effectiveTheme: BaseLoweredThemeColor;
  themeMode: LowerThemeMode;
  effectiveThemeMode: "light" | "dark";
  isLightMode: boolean;
  isDarkMode: boolean;
  updateTheme: (color: LowerThemeColor) => Promise<void>;
  updateThemeMode: (mode: LowerThemeMode) => Promise<void>;
  getThemeClass: (
    type: "primary" | "secondary" | "accent" | "hover" | "border" | "background"
  ) => string;
  getTextClass: () => string;
  randomTimeLeft?: string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);
