import type { UserAction } from "@/contexts/messages";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface UserActionCardProps {
  action: UserAction;
  timestamp?: Date | string | null;
  className?: string;
}

function formatMessageTime(timestamp: Date | string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserActionCard({ action, timestamp, className }: UserActionCardProps) {
  const diffs = action.diffs || [];

  return (
    <div
      className={cn(
        "w-fit max-w-full rounded-2xl rounded-br-none bg-muted-foreground/15 px-3 py-2 text-left",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <RefreshCw className="h-4 w-4 text-primary" />
        <span>{action.title}</span>
      </div>
      {diffs.length > 0 && (
        <div className="mt-2 space-y-2">
          {diffs.map((diff) => (
            <div key={diff.label} className="rounded-lg bg-background/45 px-2.5 py-2">
              <div className="text-xs font-medium text-muted-foreground">
                {diff.label}
              </div>
              <div className="mt-1 grid gap-1 text-xs">
                <div className="text-muted-foreground">
                  Old: <span className="text-foreground/80">{diff.oldValue}</span>
                </div>
                <div className="text-muted-foreground">
                  New: <span className="text-foreground">{diff.newValue}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {action.note && (
        <div className="mt-2 rounded-lg bg-background/45 px-2.5 py-2 text-xs text-foreground/85">
          {action.note}
        </div>
      )}
      {timestamp ? (
        <div className="mt-1 text-right text-[10px] leading-none text-muted-foreground/70">
          {formatMessageTime(timestamp)}
        </div>
      ) : null}
    </div>
  );
}
