import {
  type BaseLoweredThemeColor,
  type LowerThemeColor,
} from "@/utils/theme";
import { createContext } from "react";

export interface ThemeContextType {
  currentTheme: LowerThemeColor;
  effectiveTheme: BaseLoweredThemeColor;
  updateTheme: (color: LowerThemeColor) => Promise<void>;
  getThemeClass: (
    type: "primary" | "secondary" | "accent" | "hover" | "border" | "background"
  ) => string;
  getTextClass: () => string;
  randomTimeLeft?: string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);
