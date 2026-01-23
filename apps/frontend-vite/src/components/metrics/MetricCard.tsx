import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { type Metric } from "@tsw/prisma";
import React from "react";

interface MetricCardProps {
  metric: Metric;
  isSelected: boolean;
  onSelect: (metricId: string) => void;
  entryCount?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  isSelected,
  onSelect,
  entryCount = 0,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  return (
    <div
      className={`relative flex items-center justify-center h-20 rounded-lg ring-2 bg-card cursor-pointer transition-all ${
        isSelected
          ? `${variants.ringBright} ${variants.veryFadedBg}`
          : "ring-border hover:ring-muted-foreground/50"
      }`}
      onClick={() => onSelect(metric.id)}
    >
      <span className="text-5xl">{metric.emoji}</span>
      {entryCount > 0 && (
        <div className="absolute bottom-1 right-1 text-[10px] text-muted-foreground bg-muted/80 rounded-full px-1.5">
          {entryCount}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
