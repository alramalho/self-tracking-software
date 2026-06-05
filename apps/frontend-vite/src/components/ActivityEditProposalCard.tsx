import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Check, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

type MeasureConversion = {
  operator: "multiply" | "divide";
  factor: number;
};

type ActivityEditValues = {
  title: string;
  emoji: string;
  measure: string;
  colorHex: string | null;
  kind: string | null;
};

interface ActivityEditProposalCardProps {
  messageId: string;
  proposalIndex: number;
  activityName: string;
  activityEmoji: string;
  description: string;
  original: ActivityEditValues;
  requested: ActivityEditValues;
  measureConversion?: MeasureConversion | null;
  status?: "accepted" | "rejected" | null;
  onAccept: (messageId: string, proposalIndex: number) => Promise<void>;
  onReject: (messageId: string, proposalIndex: number) => Promise<void>;
}

const PREVIEW_QUANTITY = 60;

function formatMeasure(measure: string, quantity: number) {
  const trimmed = measure.trim();
  if (quantity === 1 && trimmed.endsWith("s")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function formatValue(value: string | null) {
  return value && value.trim() ? value : "None";
}

export function ActivityEditProposalCard({
  messageId,
  proposalIndex,
  activityName,
  activityEmoji,
  description,
  original,
  requested,
  measureConversion,
  status,
  onAccept,
  onReject,
}: ActivityEditProposalCardProps) {
  const themeColors = useThemeColors();
  const [isAccepted, setIsAccepted] = useState(status === "accepted");
  const [isRejected, setIsRejected] = useState(status === "rejected");
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const changes = useMemo(
    () =>
      (["title", "emoji", "measure", "colorHex", "kind"] as const)
        .map((field) => ({
          field,
          from: original[field],
          to: requested[field],
        }))
        .filter((change) => change.from !== change.to),
    [original, requested]
  );

  const previewQuantity =
    measureConversion?.operator === "multiply"
      ? PREVIEW_QUANTITY * measureConversion.factor
      : measureConversion?.operator === "divide"
        ? PREVIEW_QUANTITY / measureConversion.factor
        : null;

  const label = `${activityEmoji} ${activityName} (${changes.length} change${changes.length === 1 ? "" : "s"})`;
  const isResolved = isAccepted || isRejected;

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await onAccept(messageId, proposalIndex);
      setIsAccepted(true);
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Failed to accept activity edit proposal:", error);
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
      console.error("Failed to reject activity edit proposal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const reviewDrawer = (
    <AppleLikePopover
      open={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      title="Review Activity Changes"
      className="max-h-[92dvh] sm:max-w-lg"
    >
      <div className="flex max-h-[calc(92dvh-2rem)] w-full flex-col">
        <div className="flex shrink-0 flex-col items-center gap-2 pb-4 pt-1 text-center">
          <span className="text-5xl">{requested.emoji || activityEmoji}</span>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Review Activity
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="min-h-0 max-h-[52dvh] space-y-2 overflow-y-auto px-1 pb-4">
          {changes.map((change) => (
            <div
              key={change.field}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {change.field === "colorHex" ? "Color" : change.field}
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <span className="truncate text-muted-foreground">
                  {formatValue(change.from)}
                </span>
                <span className="text-muted-foreground">-&gt;</span>
                <span className="truncate font-medium text-foreground">
                  {formatValue(change.to)}
                </span>
              </div>
            </div>
          ))}

          {measureConversion && previewQuantity !== null && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                Quantity conversion
              </div>
              <div className="mt-2 text-sm text-foreground">
                {PREVIEW_QUANTITY}{" "}
                {formatMeasure(original.measure, PREVIEW_QUANTITY)} ={" "}
                {previewQuantity}{" "}
                {formatMeasure(requested.measure, previewQuantity)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Existing quantities will be{" "}
                {measureConversion.operator === "multiply"
                  ? "multiplied"
                  : "divided"}{" "}
                by {measureConversion.factor}.
              </div>
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
              {isAccepted ? "Activity changes accepted" : "Activity changes rejected"}
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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${
          isResolved ? "bg-muted/30 opacity-60" : themeColors.fadedBg
        }`}
      >
        <span
          className={`flex-1 text-sm ${
            isRejected
              ? "text-muted-foreground line-through"
              : isAccepted
                ? "text-foreground/70"
                : "font-medium text-foreground"
          }`}
        >
          {label}
        </span>
        {isRejected ? (
          <X size={14} className="flex-shrink-0 text-red-500" />
        ) : isAccepted ? (
          <Check size={14} className="flex-shrink-0 text-green-500" />
        ) : null}
      </button>
      {reviewDrawer}
    </>
  );
}
