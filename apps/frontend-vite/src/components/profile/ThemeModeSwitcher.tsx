import AppleLikePopover from "@/components/AppleLikePopover";
import { useTheme } from "@/contexts/theme/useTheme";
import type { LowerThemeMode } from "@/contexts/theme/service";
import { Check, Moon, Sun, Monitor } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";

interface ThemeModeOption {
  name: string;
  mode: LowerThemeMode;
  description: string;
  icon: React.ReactNode;
}

interface ThemeModeSwitcherProps {
  open: boolean;
  onClose: () => void;
}

const themeModeOptions: ThemeModeOption[] = [
  {
    name: "Light",
    mode: "light" as LowerThemeMode,
    description: "Always use light theme",
    icon: <Sun className="w-5 h-5" />,
  },
  {
    name: "Dark",
    mode: "dark" as LowerThemeMode,
    description: "Always use dark theme",
    icon: <Moon className="w-5 h-5" />,
  },
  {
    name: "Auto",
    mode: "auto" as LowerThemeMode,
    description: "Match system preference",
    icon: <Monitor className="w-5 h-5" />,
  },
];

const ThemeModeSwitcher: React.FC<ThemeModeSwitcherProps> = ({
  open,
  onClose,
}) => {
  const { themeMode, updateThemeMode } = useTheme();

  const handleThemeModeChange = async (mode: LowerThemeMode) => {
    try {
      await updateThemeMode(mode);
      toast.success(`Theme mode updated to ${mode}`);
      onClose();
    } catch (error) {
      console.error("Failed to update theme mode:", error);
      toast.error("Failed to update theme mode");
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold mb-4">Theme Mode</h3>
        <div className="grid gap-3">
          {themeModeOptions.map((option) => {
            const isSelected = themeMode === option.mode;
            return (
              <div
                key={option.name}
                className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                  isSelected ? "ring-2 ring-ring ring-offset-2" : ""
                }`}
                onClick={() => handleThemeModeChange(option.mode)}
              >
                <div className="text-muted-foreground">{option.icon}</div>
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppleLikePopover>
  );
};

export default ThemeModeSwitcher;
