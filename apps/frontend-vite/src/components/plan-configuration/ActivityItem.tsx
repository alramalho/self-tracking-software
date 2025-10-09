import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { type Activity } from "@tsw/prisma";
import { Check } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface ActivityItemProps {
  activity: Activity;
  isSelected: boolean;
  className?: string;
  onToggle: () => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  isSelected,
  onToggle,
  className,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  return (
    <div
      onClick={onToggle}
      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 aspect-square cursor-pointer transition-colors ${
        isSelected
          ? twMerge(variants.card.selected.border, variants.card.selected.bg)
          : "border-gray-200 hover:bg-gray-50"
      } ${className}`}
    >
      <div className="relative w-full h-full flex flex-col items-start justify-center">
        {isSelected && (
          <Check className={`absolute top-0 right-0 h-4 w-4 ${variants.text}`} />
        )}
        <span className="text-xl">{activity.emoji}</span>
        <p className="text-sm font-medium text-left">{activity.title}</p>
        <p className="text-xs text-gray-500 text-left">{activity.measure}</p>
      </div>
    </div>
  );
};

export default ActivityItem; 