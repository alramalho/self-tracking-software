import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";

export interface ResolvedOperation {
  date: string;
  type: string;
  quantity: number;
  activityName: string;
  activityEmoji: string;
  activityMeasure: string;
  descriptiveGuide?: string;
}

interface PlanProposalCardProps {
  messageId: string;
  proposalIndex: number;
  planGoal: string;
  planEmoji: string | null;
  operations: ResolvedOperation[];
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

export function PlanProposalCard({
  messageId,
  proposalIndex,
  planGoal,
  planEmoji,
  operations,
  status,
  onAccept,
  onReject,
}: PlanProposalCardProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
    } catch (error) {
      console.error("Failed to accept proposal:", error);
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
      console.error("Failed to reject proposal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const compactLabel = (
    <span>
      {planEmoji && <span className="mr-1">{planEmoji}</span>}
      {planGoal}
      <span className="text-muted-foreground ml-1">({operations.length} change{operations.length !== 1 ? "s" : ""})</span>
    </span>
  );

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 opacity-60 mt-2">
        <span className="text-sm text-muted-foreground line-through">{compactLabel}</span>
        <X size={14} className="text-red-500 flex-shrink-0" />
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 opacity-60 mt-2">
        <span className="text-sm text-foreground/70">{compactLabel}</span>
        <Check size={14} className="text-green-500 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className={`rounded-lg mt-2 px-3 py-2.5 ${themeColors.fadedBg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            {planEmoji && <span className="mr-1">{planEmoji}</span>}
            {planGoal}
          </div>
          {operations.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {operations.map((op, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-foreground/80">
                  <span>{op.activityEmoji}</span>
                  <span className="text-muted-foreground">{format(parseISO(op.date), "EEE, MMM d")}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>
                    {op.type === "add" ? "+" : op.type === "remove" ? "-" : ""}
                    {op.quantity} {op.activityMeasure}
                  </span>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
}
