import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Goal,
  Loader2,
  X,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { PlanNotesBlock } from "./PlanNotesBlock";

export interface ResolvedOperation {
  date?: string;
  type: string;
  quantity?: number;
  activityName?: string;
  activityEmoji?: string;
  activityMeasure?: string;
  descriptiveGuide?: string;
  goal?: string;
  goalReason?: string | null;
  notes?: string | null;
  finishingDate?: string | null;
  outlineType?: string | null;
  timesPerWeek?: number;
  milestoneDescription?: string;
  milestoneDate?: string;
  milestoneProgress?: number | null;
  milestoneCriteria?: unknown;
}

interface PlanProposalCardProps {
  messageId: string;
  proposalIndex: number;
  planGoal: string;
  planEmoji: string | null;
  description?: string;
  operations: ResolvedOperation[];
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
};

function getOperationTitle(op: ResolvedOperation) {
  if (op.type === "archive") return "Archive plan";
  if (op.type === "update_plan") return "Update plan setup";
  if (op.type === "add_milestone") return "Add milestone";
  if (op.type === "update_milestone") return "Update milestone";
  if (op.type === "delete_milestone") return "Remove milestone";
  if (op.type === "delete_session" || op.type === "remove") return "Remove session";
  if (op.type === "add_session" || op.type === "add") return "Add session";
  return "Update session";
}

function getOperationIcon(op: ResolvedOperation) {
  if (op.type === "archive") {
    return <Archive className="h-5 w-5 text-muted-foreground" />;
  }
  if (op.type === "update_plan") {
    return <Goal className="h-5 w-5 text-muted-foreground" />;
  }
  if (op.type.includes("milestone")) {
    return <Flag className="h-5 w-5 text-muted-foreground" />;
  }
  return <CalendarDays className="h-5 w-5 text-muted-foreground" />;
}

function OperationDetail({ op }: { op: ResolvedOperation }) {
  if (op.type === "archive") {
    return <div className="text-sm text-muted-foreground">This plan will be archived.</div>;
  }

  if (op.type === "update_plan") {
    const hasVisibleFields =
      op.goal !== undefined ||
      op.goalReason !== undefined ||
      op.timesPerWeek !== undefined ||
      op.finishingDate !== undefined ||
      op.outlineType !== undefined ||
      Boolean(op.notes);

    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        {op.goal && (
          <div>
            <span className="text-foreground">Goal: </span>
            {op.goal}
          </div>
        )}
        {op.goalReason !== undefined && (
          <div>
            <span className="text-foreground">Why: </span>
            {op.goalReason || "Clear"}
          </div>
        )}
        {op.timesPerWeek !== undefined && (
          <div>
            <span className="text-foreground">Frequency: </span>
            {op.timesPerWeek}x/week
          </div>
        )}
        {op.outlineType !== undefined && (
          <div>
            <span className="text-foreground">Plan type: </span>
            {op.outlineType === "SPECIFIC"
              ? "Specific sessions"
              : op.outlineType === "TIMES_PER_WEEK"
                ? "Times per week"
                : op.outlineType || "Clear"}
          </div>
        )}
        {op.finishingDate !== undefined && (
          <div>
            <span className="text-foreground">Finishing date: </span>
            {op.finishingDate ? formatDate(op.finishingDate) : "No end date"}
          </div>
        )}
        {op.notes !== undefined && op.notes && (
          <div className="max-h-56 overflow-y-auto break-words">
            <div className="mb-1 text-foreground">Notes</div>
            <PlanNotesBlock notes={op.notes} />
          </div>
        )}
        {!hasVisibleFields && (
          <div>Plan setup metadata will be updated.</div>
        )}
      </div>
    );
  }

  if (op.type.includes("milestone")) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        {op.milestoneDescription && (
          <div>
            <span className="text-foreground">Milestone: </span>
            {op.milestoneDescription}
          </div>
        )}
        {op.milestoneDate && (
          <div>
            <span className="text-foreground">Date: </span>
            {formatDate(op.milestoneDate)}
          </div>
        )}
        {op.milestoneProgress !== undefined && op.milestoneProgress !== null && (
          <div>
            <span className="text-foreground">Progress: </span>
            {op.milestoneProgress}%
          </div>
        )}
        {op.milestoneCriteria ? (
          <div>
            <span className="text-foreground">Criteria: </span>
            {String(op.milestoneCriteria)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {op.date && (
        <div>
          <span className="text-foreground">Date: </span>
          {formatDate(op.date)}
        </div>
      )}
      <div>
        <span className="text-foreground">Activity: </span>
        {op.activityEmoji ? `${op.activityEmoji} ` : ""}
        {op.activityName || "Session"}
      </div>
      {op.quantity !== undefined && (
        <div>
          <span className="text-foreground">Quantity: </span>
          {op.quantity} {op.activityMeasure}
        </div>
      )}
      {op.descriptiveGuide && (
        <div>
          <span className="text-foreground">Guide: </span>
          {op.descriptiveGuide}
        </div>
      )}
    </div>
  );
}

function OperationReviewRow({ op }: { op: ResolvedOperation }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        {getOperationIcon(op)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {getOperationTitle(op)}
        </p>
        <div className="mt-1">
          <OperationDetail op={op} />
        </div>
      </div>
    </div>
  );
}

function OperationInlineSummary({ op }: { op: ResolvedOperation }) {
  if (op.type === "archive") {
    return (
      <>
        <Archive size={13} className="text-muted-foreground" />
        <span>Archive plan</span>
      </>
    );
  }

  if (op.type === "update_plan") {
    return (
      <>
        <span>🎯</span>
        <span>
          {op.goal ? `Update goal to "${op.goal}"` : "Update plan setup"}
          {op.timesPerWeek ? `, ${op.timesPerWeek}x/week` : ""}
          {op.finishingDate !== undefined
            ? `, ${op.finishingDate ? `until ${formatDate(op.finishingDate)}` : "no end date"}`
            : ""}
        </span>
      </>
    );
  }

  if (op.type.includes("milestone")) {
    return (
      <>
        <Flag size={13} className="text-muted-foreground" />
        <span>
          {getOperationTitle(op)}
          {op.milestoneDescription ? `: ${op.milestoneDescription}` : ""}
          {op.milestoneProgress !== undefined && op.milestoneProgress !== null
            ? `, ${op.milestoneProgress}%`
            : ""}
        </span>
      </>
    );
  }

  return (
    <>
      {op.type === "delete_session" ? (
        <CalendarDays size={13} className="text-muted-foreground" />
      ) : (
        <span>{op.activityEmoji}</span>
      )}
      {op.date && (
        <span className="text-muted-foreground">{format(new Date(op.date), "EEE, MMM d")}</span>
      )}
      <span className="text-muted-foreground">-</span>
      <span>
        {op.type === "add" || op.type === "add_session"
          ? "+"
          : op.type === "remove" || op.type === "delete_session"
            ? "-"
            : ""}
        {op.quantity !== undefined ? `${op.quantity} ${op.activityMeasure}` : op.activityName || "Session"}
      </span>
    </>
  );
}

export function PlanProposalCard({
  messageId,
  proposalIndex,
  planGoal,
  planEmoji,
  description,
  operations,
  status,
  onAccept,
  onReject,
}: PlanProposalCardProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
      setIsDrawerOpen(false);
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
      setIsDrawerOpen(false);
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
      <span className="ml-1 text-muted-foreground">
        ({operations.length} change{operations.length !== 1 ? "s" : ""})
      </span>
    </span>
  );
  const isResolved = isAccepted || isRejected;
  const visibleOperationSummaries = operations.slice(0, 3);

  const reviewDrawer = (
    <AppleLikePopover
      open={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      title="Review Changes"
      className="max-h-[92dvh] sm:max-w-lg"
    >
      <div className="flex max-h-[calc(92dvh-2rem)] w-full flex-col">
        <div className="flex shrink-0 flex-col items-center gap-2 pb-4 pt-1 text-center">
          <span className="text-5xl">{planEmoji || "🎯"}</span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Review Changes
          </h2>
          <p className="text-sm text-muted-foreground">
            On {planGoal}
          </p>
        </div>

        <div className="min-h-0 max-h-[52dvh] space-y-2 overflow-y-auto px-1 pb-4">
          {description && (
            <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              {description}
            </div>
          )}
          {operations.length > 0 ? (
            operations.map((op, index) => (
              <OperationReviewRow key={`${op.type}-${index}`} op={op} />
            ))
          ) : (
            <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
              No concrete changes are included in this proposal.
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-1 pt-4">
          {isResolved ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 py-3 text-sm text-muted-foreground">
              {isAccepted ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <X size={16} className="text-red-500" />
              )}
              {isAccepted ? "Plan changes accepted" : "Plan changes rejected"}
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
                Accept Changes
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
            {compactLabel}
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
          <span className="flex-1 text-sm text-foreground/70">{compactLabel}</span>
          <Check size={14} className="flex-shrink-0 text-green-500" />
        </button>
        {reviewDrawer}
      </>
    );
  }

  return (
    <>
      <div className={`mt-2 rounded-lg px-3 py-2.5 ${themeColors.fadedBg}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {planEmoji && <span>{planEmoji}</span>}
              <span className="min-w-0 truncate">{planGoal}</span>
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
            </div>
            {description && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </div>
            )}
            {operations.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {visibleOperationSummaries.map((op, index) => (
                  <div
                    key={`${op.type}-${index}`}
                    className="flex items-start gap-1.5 text-xs text-foreground/80"
                  >
                    <OperationInlineSummary op={op} />
                  </div>
                ))}
                {operations.length > visibleOperationSummaries.length && (
                  <div className="text-xs text-muted-foreground">
                    +{operations.length - visibleOperationSummaries.length} more change
                    {operations.length - visibleOperationSummaries.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            )}
          </button>
          <div className="flex flex-shrink-0 items-center gap-1.5">
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
      {reviewDrawer}
    </>
  );
}
