import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  direction: "left" | "right";
  className?: string;
  timestamp?: Date | string | null;
  children: React.ReactNode;
}

function formatMessageTime(timestamp: Date | string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  direction,
  className,
  timestamp,
  children
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "w-fit rounded-3xl p-3 px-4 bg-muted max-w-full",
        direction === "left" ? "rounded-bl-none" : "rounded-br-none",
        className
      )}
    >
      {children}
      {timestamp ? (
        <div className="mt-1 text-right text-[10px] leading-none text-muted-foreground/70">
          {formatMessageTime(timestamp)}
        </div>
      ) : null}
    </div>
  );
}
