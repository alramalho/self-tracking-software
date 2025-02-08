import React, { createContext, useContext, useEffect } from 'react';
import { useUserPlan } from './UserPlanContext';
import { ThemeColor, getThemeVariants } from '@/utils/theme';

interface ThemeContextType {
  currentTheme: ThemeColor;
  updateTheme: (color: ThemeColor) => Promise<void>;
  getThemeClass: (type: 'primary' | 'secondary' | 'accent' | 'hover' | 'border' | 'background') => string;
  getTextClass: () => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Utility to get computed color from a Tailwind class
const getComputedColor = (className: string): string => {
  // Create a temporary element
  const temp = document.createElement('div');
  temp.className = className;
  document.body.appendChild(temp);
  
  // Get the computed background color
  const computedColor = window.getComputedStyle(temp).backgroundColor;
  
  // Clean up
  document.body.removeChild(temp);
  return computedColor;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTheme, updateTheme } = useUserPlan();
  const themeVariants = getThemeVariants(currentTheme);

  useEffect(() => {
    // Set CSS variables
    const root = document.documentElement;
    Object.entries(themeVariants.cssVars).forEach(([key, className]) => {
      const computedColor = getComputedColor(className);
      root.style.setProperty(`--${key}`, computedColor);
    });
  }, [currentTheme, themeVariants]);

  const getThemeClass = (type: 'primary' | 'secondary' | 'accent' | 'hover' | 'border' | 'background') => {
    return themeVariants[type];
  };

  const getTextClass = () => {
    return themeVariants.text;
  };

  const value = {
    currentTheme,
    updateTheme,
    getThemeClass,
    getTextClass,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 