import { useThemeColors } from "@/hooks/useThemeColors";
import { CoachAvatar } from "../frame/controls";
import type { RouteCardProps } from "../types";
import { days, shortDate } from "./format";

const intensity = { steady: "Moderate", focused: "Intense" } as const;

// One of the coach's two routes: who, how hard, days a week, how long and when it finishes.
export function RouteCard({ option, selected, onClick }: RouteCardProps) {
  const theme = useThemeColors();
  return (
    <button
      type="button"
      data-testid={`route-${option.id}`}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[22px] bg-card p-[18px] text-left transition-opacity hover:opacity-80 ${
        selected ? `border-2 ${theme.border}` : "border border-border"
      }`}
    >
      <CoachAvatar coach={option.coach} size={64} />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[19px] font-bold text-foreground">
          {option.coach} · {intensity[option.id]}
        </span>
        <span className="text-[15px] text-muted-foreground">{days(option)} days per week</span>
        <span className="text-[15px] text-muted-foreground">
          {option.estimatedWeeks} weeks · Finish {shortDate(option.finishingDate)}
        </span>
      </span>
    </button>
  );
}
