import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Check, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";

interface PlanCreationProposalCardProps {
  messageId: string;
  proposalIndex: number;
  goal: string;
  goalReason?: string | null;
  emoji?: string | null;
  timesPerWeek?: number | null;
  activities?: Array<{ title: string; measure: string; emoji: string }>;
  description?: string;
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

export function PlanCreationProposalCard({
  messageId,
  proposalIndex,
  goal,
  goalReason,
  emoji,
  timesPerWeek,
  activities = [],
  description,
  status,
  onAccept,
  onReject,
}: PlanCreationProposalCardProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);

  const compactLabel = (
    <span>
      {emoji && <span className="mr-1">{emoji}</span>}
      {goal}
    </span>
  );

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(messageId, proposalIndex);
      setIsRejected(true);
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Plus size={14} className="text-muted-foreground" />
            <span>{compactLabel}</span>
          </div>
          {description && (
            <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
          )}
          {goalReason && (
            <div className="mt-1 text-xs text-foreground/80">{goalReason}</div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {timesPerWeek ? <span>{timesPerWeek}x/week</span> : null}
            {activities.map((activity) => (
              <span key={`${activity.title}-${activity.measure}`}>
                {activity.emoji} {activity.title} · {activity.measure}
              </span>
            ))}
          </div>
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
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
