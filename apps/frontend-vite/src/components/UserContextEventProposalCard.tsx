import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Loader2, LockKeyhole, X } from "lucide-react";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

interface UserContextEventProposalCardProps {
  messageId: string;
  proposalIndex: number;
  title: string;
  description?: string | null;
  occurredAt?: string | null;
  endedAt?: string | null;
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

function formatEventDate(value?: string | null) {
  if (!value) return null;
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return null;
  }
}

export function UserContextEventProposalCard({
  messageId,
  proposalIndex,
  title,
  description,
  occurredAt,
  endedAt,
  status,
  onAccept,
  onReject,
}: UserContextEventProposalCardProps) {
  const [localStatus, setLocalStatus] = useState(status || null);
  const [isLoading, setIsLoading] = useState(false);

  const dateLabel = useMemo(() => {
    const start = formatEventDate(occurredAt);
    const end = formatEventDate(endedAt);
    if (start && end && start !== end) return `${start} - ${end}`;
    return start || end;
  }, [endedAt, occurredAt]);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setLocalStatus("accepted");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(messageId, proposalIndex);
      setLocalStatus("rejected");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border border-border bg-card/80 p-3 shadow-sm",
        localStatus === "rejected" && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          <LockKeyhole className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <span>Private context</span>
            {dateLabel && (
              <span className="inline-flex min-w-0 items-center gap-1 normal-case">
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="truncate">{dateLabel}</span>
              </span>
            )}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{title}</div>
          {description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      {localStatus ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {localStatus === "accepted" ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          {localStatus === "accepted" ? "Context saved" : "Context dismissed"}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={isLoading}
            onClick={handleReject}
          >
            <X className="mr-2 h-4 w-4" />
            Dismiss
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={isLoading}
            onClick={handleAccept}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
