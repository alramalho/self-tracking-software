import { Check } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";  
import { getThemeVariants, ThemeColor } from "@/utils/theme";
import { twMerge } from "tailwind-merge";

interface DurationOptionProps {
  type: "habit" | "lifestyle" | "custom";
  title: string;
  emoji: string;
  isSelected: boolean;
  onSelect: () => void;
}

const DurationOption: React.FC<DurationOptionProps> = ({
  type,
  title,
  emoji,
  isSelected,
  onSelect,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? twMerge(variants.card.selected.border, variants.card.selected.bg)
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      {isSelected && (
        <Check className={`absolute top-3 right-3 h-4 w-4 ${variants.text}`} />
      )}
      <span className="text-2xl mb-2">{emoji}</span>
      <h4 className="font-medium mb-1">{title}</h4>
    </div>
  );
};

export default DurationOption; 