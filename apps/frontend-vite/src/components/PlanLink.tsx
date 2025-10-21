import { useThemeColors } from "@/hooks/useThemeColors";
import { useNavigate } from "@tanstack/react-router";
import { Target } from "lucide-react";

interface PlanLinkProps {
  planId: string;
  displayText: string;
  emoji?: string;
}

export function PlanLink({ planId, displayText, emoji }: PlanLinkProps) {
  const navigate = useNavigate();
  const themeColors = useThemeColors();

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium cursor-pointer rounded-md px-2 py-0.5 transition-all text-white/90 ${themeColors.fadedBg} hover:${themeColors.bg}`}
      onClick={() =>
        navigate({ to: "/plans", search: { selectedPlan: planId } })
      }
    >
      {emoji ? (
        <span className="text-base leading-none">{emoji}</span>
      ) : (
        <Target size={14} className="flex-shrink-0" />
      )}
      <span>{displayText}</span>
    </span>
  );
}
