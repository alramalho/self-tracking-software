import AppleLikePopover from "@/components/AppleLikePopover";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "@/components/ui/button";
import { CalendarDays, Check, ChevronRight, Clock, Loader2, X } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";

interface ActivityLogProposalCardProps {
  messageId: string;
  proposalIndex: number;
  activityName: string;
  activityEmoji: string;
  activityMeasure: string;
  quantity: number;
  date: string;
  time?: string;
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

export function ActivityLogProposalCard({
  messageId,
  proposalIndex,
  activityName,
  activityEmoji,
  activityMeasure,
  quantity,
  date,
  time,
  status,
  onAccept,
  onReject,
}: ActivityLogProposalCardProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const parsedTime = (() => {
    if (!time || time === "00:00:00") return null;
    const [h, m] = time.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return d;
  })();

  const formattedDay = (() => {
    try {
      return format(parseISO(date), "MMM d");
    } catch {
      return date;
    }
  })();
  const formattedTime = parsedTime ? format(parsedTime, "h:mm a") : null;
  const formattedDate = formattedTime
    ? `${formattedDay} at ${formattedTime}`
    : formattedDay;

  const label = `${activityEmoji} ${activityName} — ${quantity} ${activityMeasure} on ${formattedDate}`;

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Failed to accept activity log proposal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(messageId, proposalIndex);
      setIsRejected(true);
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Failed to reject activity log proposal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const reviewDrawer = (
    <AppleLikePopover
      open={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      title="Review Activity Log"
      className="max-h-[92dvh] sm:max-w-lg"
    >
      <div className="flex max-h-[calc(92dvh-2rem)] w-full flex-col">
        <div className="flex shrink-0 flex-col items-center gap-2 pb-4 pt-1 text-center">
          <span className="text-5xl">{activityEmoji || "📋"}</span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Review Log
          </h2>
          <p className="text-sm text-muted-foreground">
            Add this activity entry to your timeline
          </p>
        </div>

        <div className="min-h-0 max-h-[52dvh] space-y-2 overflow-y-auto px-1 pb-4">
          <div className="rounded-xl border border-border bg-card p-3 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                <span className="text-xl leading-none">{activityEmoji || "📋"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Activity
                </p>
                <div className="mt-0.5 text-sm font-medium text-foreground">
                  {activityName}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-card p-3 text-left">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Quantity
              </p>
              <div className="mt-1 text-sm font-medium text-foreground">
                {quantity} {activityMeasure}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Date
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {formattedDay}
              </div>
            </div>
          </div>

          {formattedTime && (
            <div className="rounded-xl border border-border bg-card p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Time
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {formattedTime}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-1 pt-4">
          {isAccepted || isRejected ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 py-3 text-sm text-muted-foreground">
              {isAccepted ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <X size={16} className="text-red-500" />
              )}
              {isAccepted ? "Activity log accepted" : "Activity log rejected"}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReject}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button className="flex-1" onClick={handleAccept} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Accept Log
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppleLikePopover>
  );

  if (isRejected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-60"
        >
          <span className="flex-1 text-sm text-muted-foreground line-through">
            {label}
          </span>
          <X size={14} className="flex-shrink-0 text-red-500" />
        </button>
        {reviewDrawer}
      </>
    );
  }

  if (isAccepted) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left opacity-60"
        >
          <span className="flex-1 text-sm text-foreground/70">{label}</span>
          <Check size={14} className="flex-shrink-0 text-green-500" />
        </button>
        {reviewDrawer}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${themeColors.fadedBg}`}
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground p-2">
          {label}
        </span>
        <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" />
      </button>
      {reviewDrawer}
    </>
  );
}
