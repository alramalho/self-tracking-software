import { cn } from "@/lib/utils";

interface HomeCardShellProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const HomeCardShell = ({
  children,
  onClick,
  className,
}: HomeCardShellProps) => (
  <div
    onClick={onClick}
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
