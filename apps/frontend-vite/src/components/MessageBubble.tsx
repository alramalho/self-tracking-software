import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  direction: "left" | "right";
  className?: string;
  timestamp?: Date | string | null;
  tailPosition?: "top" | "bottom";
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
  tailPosition = "bottom",
  children
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "w-fit rounded-3xl p-3 px-4 bg-muted max-w-full",
        direction === "left" && tailPosition === "top" && "rounded-tl-none",
        direction === "left" && tailPosition === "bottom" && "rounded-bl-none",
        direction === "right" && tailPosition === "top" && "rounded-tr-none",
        direction === "right" && tailPosition === "bottom" && "rounded-br-none",
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
