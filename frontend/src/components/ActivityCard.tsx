import { Activity } from "@/contexts/UserPlanContext";
import { Edit } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants, ThemeColor } from "@/utils/theme";

export const ActivityCard = ({
  activity,
  selected,
  onClick,
  onEditClick,
}: {
  activity: Activity;
  selected?: boolean;
  onClick?: () => void;
  onEditClick?: () => void;
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);


  return (
    <div className="relative" data-testid="activity-card">
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-left justify-center p-6 rounded-lg border-2 w-full aspect-square",
          selected
            ? cn(variants.card.selected.border, variants.card.selected.bg)
            : "border-gray-300 bg-white"
        )}
      >
        {activity.emoji && (
          <span className="text-4xl mb-2 text-left">{activity.emoji}</span>
        )}
        <span className="text-xl font-medium text-left">
          {activity.title}
        </span>
        <span className="text-sm text-gray-500 text-left">
          {activity.measure}
        </span>
      </button>
      {onEditClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
        >
          <Edit className="h-4 w-4 text-gray-500" />
        </button>
      )}
    </div>
  );
};
