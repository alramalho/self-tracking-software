import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface HomeCardShellProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export const HomeCardShell = ({
  children,
  onClick,
  className,
  style,
}: HomeCardShellProps) => (
  <div
    onClick={onClick}
    style={style}
    className={cn(
      "aspect-square rounded-3xl ring-1 ring-border bg-card p-4 flex flex-col justify-between",
      "transition-all duration-200",
      onClick && "cursor-pointer active:scale-[0.97]",
      className
    )}
  >
    {children}
  </div>
);
