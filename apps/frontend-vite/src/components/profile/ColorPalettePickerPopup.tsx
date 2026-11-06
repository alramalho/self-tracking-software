import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme/useTheme";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { type LowerThemeColor as ThemeColor, getThemeVariants } from "@/utils/theme";
import { SettingsGroup, SettingsRow } from "./SettingsGroup";
import toast from "react-hot-toast";

interface ColorPalette {
  name: string;
  color: ThemeColor;
  description?: string;
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
  },
];

/** Accent colour choice. Lives on the Appearance screen. */
export default function ColorPalettePickerPopup() {
  const { currentUser } = useCurrentUser();
  const { updateTheme } = useTheme();
  const { userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  const handleThemeChange = async (color: ThemeColor) => {
    try {
      await updateTheme(color);
    } catch (error) {
      console.error("Failed to update theme:", error);
      toast.error("Failed to update theme");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup title="Color" footer="Random changes every 3 days.">
        {colorPalettes.map((palette) => {
          const isLocked =
            userPaidPlanType === "FREE" &&
            (palette.color === "random" || palette.color !== "blue");
          return (
            <SettingsRow
              key={palette.name}
              title={isLocked ? `${palette.name} 🔒` : palette.name}
              selected={
                currentUser?.themeBaseColor.toLowerCase() ===
                palette.color.toLowerCase()
              }
              disabled={isLocked}
              onClick={() => handleThemeChange(palette.color)}
              trailing={
                palette.color !== "random" ? (
                  <div className="flex gap-1.5">
                    <div className={`h-5 w-5 rounded-full ${getThemeVariants(palette.color).primary}`} />
                    <div className={`h-5 w-5 rounded-full ${getThemeVariants(palette.color).secondary}`} />
                    <div className={`h-5 w-5 rounded-full ${getThemeVariants(palette.color).accent}`} />
                  </div>
                ) : (
                  <span className="text-lg">🎲</span>
                )
              }
            />
          );
        })}
      </SettingsGroup>
      {userPaidPlanType === "FREE" && (
        <Button className="w-full" onClick={() => setShowUpgradePopover(true)}>
          Upgrade to unlock all themes
        </Button>
      )}
    </div>
  );
}
