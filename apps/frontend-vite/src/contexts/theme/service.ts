import { type LowerThemeColor } from "@/utils/theme";
import { ThemeColor, ThemeMode, type User } from "@tsw/prisma";

export type LowerThemeMode = Lowercase<ThemeMode>;

export async function updateUserTheme(
  updateUserFn: (data: {
    updates: { themeBaseColor: ThemeColor };
    muteNotifications: boolean;
  }) => Promise<User>,
  color: LowerThemeColor
): Promise<User> {
  return await updateUserFn({
    updates: { themeBaseColor: color.toUpperCase() as ThemeColor },
    muteNotifications: true,
  });
}

export async function updateUserThemeMode(
  updateUserFn: (data: {
    updates: { themeMode: ThemeMode };
    muteNotifications: boolean;
  }) => Promise<User>,
  mode: LowerThemeMode
): Promise<User> {
  // Immediately persist to localStorage to prevent flash on next page load
  if (typeof window !== "undefined") {
    localStorage.setItem("themeMode", mode);
  }

  return await updateUserFn({
    updates: { themeMode: mode.toUpperCase() as ThemeMode },
    muteNotifications: true,
  });
}
