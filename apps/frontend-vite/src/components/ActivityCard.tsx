import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { type Activity } from "@tsw/prisma";
import { Edit } from "lucide-react";

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
          "flex flex-col items-left justify-center p-6 rounded-lg border-2 w-full h-full aspect-square",
          selected
            ? cn(variants.card.selected.border, variants.card.selected.bg)
            : "border-border bg-card"
        )}
      >
        {activity.emoji && (
          <span className="text-4xl mb-2 text-left">{activity.emoji}</span>
        )}
        <span className="text-xl font-medium text-left">{activity.title}</span>
        <span className="text-sm text-muted-foreground text-left">
          {activity.measure}
        </span>
        <div
          className="absolute bottom-2 right-2 w-5 h-5 rounded-sm"
          style={{ backgroundColor: activity.colorHex || "transparent" }}
        />
      </button>
      {onEditClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          className="absolute top-2 right-2 p-1 bg-card rounded-full shadow-md hover:bg-muted"
        >
          <Edit className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};
