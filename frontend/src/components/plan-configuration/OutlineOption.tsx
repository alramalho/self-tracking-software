import { Check } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants, ThemeColor } from "@/utils/theme";
import { cn } from "@/lib/utils";

interface OutlineOptionProps {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export const OutlineOption = ({
  title,
  description,
  selected,
  onClick,
}: OutlineOptionProps) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw as ThemeColor);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-lg border-2 transition-all w-full text-left",
        selected
          ? cn(variants.card.selected.border, variants.card.selected.bg)
          : "border-gray-300 bg-white"
      )}
    >
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
      {selected && (
        <Check className={cn("absolute top-3 right-3 h-4 w-4", variants.text)} />
      )}
    </button>
  );
}; 