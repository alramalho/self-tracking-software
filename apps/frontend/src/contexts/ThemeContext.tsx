import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useUserPlan } from './UserGlobalContext';
import { BaseThemeColor, ThemeColor, getThemeVariants } from '@/utils/theme';
import { getStoredRandomColor, generateAndStoreRandomColor, useRandomColorCountdown } from '@/hooks/useThemeColors';

interface ThemeContextType {
  currentTheme: ThemeColor;
  effectiveTheme: BaseThemeColor;
  updateTheme: (color: ThemeColor) => Promise<void>;
  getThemeClass: (type: 'primary' | 'secondary' | 'accent' | 'hover' | 'border' | 'background') => string;
  getTextClass: () => string;
  randomTimeLeft?: string;
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
  const { currentTheme: userTheme, updateTheme } = useUserPlan();
  
  // Get the effective theme color (either user's choice or resolved random color)
  const effectiveTheme = useMemo<BaseThemeColor>(() => {
    if (userTheme !== 'random') return userTheme as BaseThemeColor;
    
    const storedRandom = getStoredRandomColor();
    if (storedRandom) return storedRandom.color;
    
    return generateAndStoreRandomColor();
  }, [userTheme]);

  // Get countdown for random theme
  const randomTimeLeft = useRandomColorCountdown(
    userTheme === 'random' ? getStoredRandomColor()?.expiresAt || null : null
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

  const getThemeClass = (type: 'primary' | 'secondary' | 'accent' | 'hover' | 'border' | 'background') => {
    return themeVariants[type];
  };

  const getTextClass = () => {
    return themeVariants.text;
  };

  const value = {
    currentTheme: userTheme,
    effectiveTheme,
    updateTheme,
    getThemeClass,
    getTextClass,
    randomTimeLeft: userTheme === 'random' ? randomTimeLeft : undefined,
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