import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  direction: "left" | "right";
  className?: string;
  children: React.ReactNode;
}

export function MessageBubble({
  direction,
  className,
  children
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl p-3 bg-muted",
        direction === "left" ? "rounded-bl-none" : "rounded-br-none",
        className
      )}
    >
      {children}
    </div>
  );
}
