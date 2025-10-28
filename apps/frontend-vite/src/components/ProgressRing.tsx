import { type AccountLevel } from "@/hooks/useAccountLevel";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  atLeastBronze: boolean;
  currentLevel: AccountLevel | null;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  badge?: boolean;
  badgeSize?: number;
}

export function ProgressRing({
  size = 100,
  strokeWidth = 4,
  percentage,
  atLeastBronze,
  currentLevel,
  children,
  className,
  onClick,
  badgeSize,
  badge = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Add gap by reducing the total circumference slightly
  const gapSize = circumference * 0.05; // 5% gap
  const adjustedCircumference = circumference - gapSize;
  const strokeDashoffset = adjustedCircumference - (percentage / 100) * adjustedCircumference;

  return (
    <div className={cn("relative inline-flex", className)} onClick={onClick}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        {/* <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="transparent"
        /> */}

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={currentLevel?.color || "hsl(var(--muted))"}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={adjustedCircumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
          style={{
            filter: currentLevel ? "drop-shadow(0 0 4px rgba(0,0,0,0.1))" : undefined,
          }}
        />
      </svg>

      {/* Content in the center */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>

      {/* {currentLevel && badge && (
        <div
          className="absolute -bottom-1 -right-1 w-8 h-8 p-0 rounded-full bg-transparent flex items-center justify-center"
        >
          {currentLevel.getIcon({ size: badgeSize || 45, className: "drop-shadow-sm" })}
        </div>
      )} */}
    </div>
  );
}
