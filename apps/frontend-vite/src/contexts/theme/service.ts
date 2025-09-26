import { type LowerThemeColor } from "@/utils/theme";
import { ThemeColor, type User } from "@tsw/prisma";

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
