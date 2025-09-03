import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { useCurrentUser } from "@/contexts/users";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { LowerThemeColor as ThemeColor, getThemeVariants } from "@/utils/theme";
import { Check } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";

interface ColorPalette {
  name: string;
  color: ThemeColor;
  description?: string;
}

interface ColorPalettePickerPopupProps {
  open: boolean;
  onClose: () => void;
}

const colorPalettes: ColorPalette[] = [
  {
    name: "Blue",
    color: "blue" as ThemeColor,
  },
  {
    name: "Slate",
    color: "slate" as ThemeColor,
  },
  {
    name: "Violet",
    color: "violet" as ThemeColor,
  },
  {
    name: "Emerald",
    color: "emerald" as ThemeColor,
  },
  {
    name: "Rose",
    color: "rose" as ThemeColor,
  },
  {
    name: "Amber",
    color: "amber" as ThemeColor,
  },
  {
    name: "Random",
    color: "random" as ThemeColor,
    description: "Changes every 3 days",
  },
];

const ColorPalettePickerPopup: React.FC<ColorPalettePickerPopupProps> = ({
  open,
  onClose,
}) => {
  const { currentUser } = useCurrentUser();
  const { updateTheme } = useTheme();
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  const handleThemeChange = async (color: ThemeColor) => {
    try {
      await updateTheme(color);
      toast.success(`Theme updated to ${color}`);
      onClose();
    } catch (error) {
      console.error("Failed to update theme:", error);
      toast.error("Failed to update theme");
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold mb-4">Color Themes</h3>
        <div className="grid gap-4">
          {colorPalettes.map((palette) => {
            const isSelected =
              currentUser?.themeBaseColor.toLowerCase() ===
              palette.color.toLowerCase();
            const isLocked =
              userPaidPlanType === "FREE" &&
              (palette.color === "random" || palette.color !== "blue");
            return (
              <div
                key={palette.name}
                className={`flex items-center gap-4 p-3 border rounded-lg ${
                  isLocked
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50 cursor-pointer"
                } ${
                  isSelected
                    ? `ring-2 ring-offset-2 ${
                        palette.color === "random"
                          ? "ring-gray-500"
                          : `ring-${palette.color}-500`
                      }`
                    : ""
                }`}
                onClick={() => !isLocked && handleThemeChange(palette.color)}
              >
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 ${
                        palette.color === "random"
                          ? "text-gray-500"
                          : `text-${palette.color}-500`
                      }`}
                    />
                  )}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{palette.name}</span>
                      {isLocked && (
                        <span className="text-xs text-gray-500">🔒</span>
                      )}
                    </div>
                    {palette.description && (
                      <span className="text-xs text-gray-500">
                        {palette.description}
                      </span>
                    )}
                  </div>
                </div>
                {palette.color !== "random" ? (
                  <div className="flex gap-2 ml-auto">
                    <div
                      className={`w-6 h-6 rounded-full ${
                        getThemeVariants(palette.color).primary
                      }`}
                    ></div>
                    <div
                      className={`w-6 h-6 rounded-full ${
                        getThemeVariants(palette.color).secondary
                      }`}
                    ></div>
                    <div
                      className={`w-6 h-6 rounded-full ${
                        getThemeVariants(palette.color).accent
                      }`}
                    ></div>
                  </div>
                ) : (
                  <div className="ml-auto text-2xl">🎲</div>
                )}
              </div>
            );
          })}
        </div>
        {userPaidPlanType === "FREE" && (
          <Button
            className="w-full mt-6"
            onClick={() => setShowUpgradePopover(true)}
          >
            Upgrade to unlock all themes
          </Button>
        )}
      </div>
    </AppleLikePopover>
  );
};

export default ColorPalettePickerPopup;
