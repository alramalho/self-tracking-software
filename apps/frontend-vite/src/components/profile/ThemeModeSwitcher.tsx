import { useTheme } from "@/contexts/theme/useTheme";
import type { LowerThemeMode } from "@/contexts/theme/service";
import { Monitor, Moon, Sun } from "lucide-react";
import toast from "react-hot-toast";
import { SettingsGroup, SettingsRow } from "./SettingsGroup";

const themeModeOptions = [
  { name: "Light", mode: "light" as LowerThemeMode, icon: Sun },
  { name: "Dark", mode: "dark" as LowerThemeMode, icon: Moon },
  { name: "Auto", mode: "auto" as LowerThemeMode, icon: Monitor },
];

/** Light, dark or follow the device. Lives on the Appearance screen. */
export default function ThemeModeSwitcher() {
  const { themeMode, updateThemeMode } = useTheme();

  const handleThemeModeChange = async (mode: LowerThemeMode) => {
    try {
      await updateThemeMode(mode);
    } catch (error) {
      console.error("Failed to update theme mode:", error);
      toast.error("Failed to update theme mode");
    }
  };

  return (
    <SettingsGroup title="Mode" footer="Auto matches your device's setting.">
      {themeModeOptions.map((option) => (
        <SettingsRow
          key={option.mode}
          icon={option.icon}
          title={option.name}
          selected={themeMode === option.mode}
          onClick={() => handleThemeModeChange(option.mode)}
        />
      ))}
    </SettingsGroup>
  );
}
