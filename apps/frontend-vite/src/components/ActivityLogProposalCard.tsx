import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
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

  const formattedDate = (() => {
    try {
      const datePart = format(parseISO(date), "MMM d");
      if (time && time !== "00:00:00") {
        const [h, m] = time.split(":");
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        return `${datePart} at ${format(d, "h:mm a")}`;
      }
      return datePart;
    } catch {
      return date;
    }
  })();

  const label = `${activityEmoji} ${activityName} — ${quantity} ${activityMeasure} on ${formattedDate}`;

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
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
    } catch (error) {
      console.error("Failed to reject activity log proposal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 opacity-60 mt-2">
        <span className="text-sm text-muted-foreground line-through">{label}</span>
        <X size={14} className="text-red-500 flex-shrink-0" />
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 opacity-60 mt-2">
        <span className="text-sm text-foreground/70">{label}</span>
        <Check size={14} className="text-green-500 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mt-2 ${themeColors.fadedBg}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={handleReject}
          disabled={isLoading}
        >
          <X size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={handleAccept}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
        </Button>
      </div>
    </div>
  );
}
