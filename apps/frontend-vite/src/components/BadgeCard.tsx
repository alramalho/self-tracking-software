import { cn } from "@/lib/utils";

interface BadgeCardProps {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
  count: number;
  width: number;
  height: number;
}

export function BadgeCard({
  className,
  onClick,
  children,
  count,
  width,
  height,
}: BadgeCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        `overflow-hidden m-0 relative ring-2 ring-border rounded-xl cursor-pointer bg-card`,
        className,
        count == 0 ? "grayscale opacity-50" : ""
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <span className="ml-2 text-3xl font-cursive">x{count}</span>
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
