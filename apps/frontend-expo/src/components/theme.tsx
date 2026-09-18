import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "expo-router";
import { createContext, useContext, useEffect, useState } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { useCurrentUser } from "@/data/queries";
import { useSession } from "@/auth/provider";
import type { ChildrenProps } from "@/core/types";
const ThemeContext = createContext({ mode: "dark", base: "blue" });
export function ThemeProvider({ children }: ChildrenProps) {
  const session = useSession();
  const user = useCurrentUser(session.isSignedIn);
  const [randomBase, setRandomBase] = useState("blue");
  const base = user.data?.themeBaseColor?.toLowerCase() ?? "blue";
  useEffect(() => {
    if (base !== "random" || !session.userId) return;
    let active = true;
    const key = `random-theme:${session.userId}`;
    const resolve = async () => {
      const stored = await AsyncStorage.getItem(key);
      let saved;
      try {
        saved = stored ? JSON.parse(stored) : null;
      } catch {}
      const colors = ["slate", "blue", "violet", "amber", "emerald", "rose"];
      if (
        !saved ||
        !colors.includes(saved.color) ||
        !(saved.expiresAt > Date.now())
      ) {
        saved = {
          color: colors[Math.floor(Math.random() * colors.length)],
          expiresAt: Date.now() + 3 * 86400000,
        };
        await AsyncStorage.setItem(key, JSON.stringify(saved));
      }
      if (active) setRandomBase(saved.color);
    };
    void resolve().catch(() => {});
    const timer = setInterval(() => void resolve().catch(() => {}), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [base, session.userId]);
  const mode =
    user.data?.themeMode?.toLowerCase() ??
    (session.isSignedIn ? "dark" : "auto");
  useEffect(() => {
    if (Platform.OS === "web") return;
    Appearance.setColorScheme(
      mode === "auto" ? "unspecified" : mode === "light" ? "light" : "dark",
    );
  }, [mode]);
  return (
    <ThemeContext.Provider
      value={{
        mode,
        base: base === "random" ? randomBase : base,
      }}
    >
      <NavigationTheme>{children}</NavigationTheme>
    </ThemeContext.Provider>
  );
}
export function useColors() {
  const theme = useContext(ThemeContext);
  const system = useColorScheme();
  const dark =
    theme.mode === "auto" ? system === "dark" : theme.mode === "dark";
  const accents: Record<string, string> = {
    slate: "#64748b",
    blue: "#3b82f6",
    violet: "#8b5cf6",
    amber: "#f59e0b",
    emerald: "#10b981",
    rose: "#f43f5e",
  };
  const bright: Record<string, string> = {
    slate: "#94a3b8",
    blue: "#00bcff",
    violet: "#a5b4fc",
    amber: "#fcd34d",
    emerald: "#56d364",
    rose: "#fda4af",
  };
  // Native equivalents of Vite's veryFadedBg and ringBright theme variants.
  const selections: Record<string, [string, string, string, string]> = {
    slate: ["#f8fafc", "#cbd5e1", "#45556c4d", "#314158"],
    blue: ["#eff6ff", "#8ec5ff", "#155dfb4d", "#1447e6"],
    violet: ["#f5f3ff", "#c4b4ff", "#7f22fe4d", "#7008e7"],
    amber: ["#fffbeb", "#ffd230", "#e171004d", "#bb4d00"],
    emerald: ["#ecfdf5", "#5ee9b5", "#0099664d", "#007a55"],
    rose: ["#fff1f2", "#ffa1ad", "#ec003f4d", "#c70036"],
  };
  const faded: Record<string, [string, string]> = {
    slate: ["#e2e8f080", "#1d293d80"],
    blue: ["#bedbff80", "#193cb880"],
    violet: ["#ede9fe", "#5b21b680"],
    amber: ["#fef3c6", "#973c0080"],
    emerald: ["#d0fae5", "#00604580"],
    rose: ["#ffe4e6", "#a5003680"],
  };
  const selection = selections[theme.base] ?? selections.blue;
  return {
    dark,
    bg: dark ? "#1c1c1c" : "#f2f2f2",
    card: dark ? "#141414" : "#fafafa",
    text: dark ? "#fafafa" : "#09090b",
    muted: dark ? "#a1a1aa" : "#71717a",
    border: dark ? "#1a1a1a" : "#e4e4e7",
    inputBorder: dark ? "#2e2e32" : "#dcdce0",
    accent: accents[theme.base] ?? accents.blue,
    bright: bright[theme.base] ?? bright.blue,
    selectedBg: selection[dark ? 2 : 0],
    fadedBg: (faded[theme.base] ?? faded.blue)[dark ? 1 : 0],
    selectedBorder: selection[dark ? 3 : 1],
    soft: dark ? "#27272a" : "#e4e4e7",
  };
}

function NavigationTheme({ children }: ChildrenProps) {
  const c = useColors();
  const base = c.dark ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: c.accent,
          background: c.bg,
          card: c.card,
          text: c.text,
          border: c.border,
        },
      }}
    >
      {children}
    </NavigationThemeProvider>
  );
}
