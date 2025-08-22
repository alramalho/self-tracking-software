import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  max: number;
  className?: string;
}

export function ProgressBar({ current, max, className }: ProgressBarProps) {
  const percentage = (current / max) * 100;
  
  return (
    <div className={cn("w-full h-2 bg-gray-200 rounded-full overflow-hidden", className)}>
      <div 
        className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}