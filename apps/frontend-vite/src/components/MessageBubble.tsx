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
        "w-fit rounded-2xl p-3 px-4 bg-muted max-w-full",
        direction === "left" ? "rounded-bl-none" : "rounded-br-none",
        className
      )}
    >
      {children}
    </div>
  );
}
