import { useApiWithAuth } from "@/api";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Eye,
  HeartPulse,
  Loader2,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import {
  applyWorkoutReconciliations,
  getWorkoutReconciliationPreview,
} from "../service";
import type {
  AppleHealthWorkoutReconciliationProps,
  TrackingWorkoutCandidate,
  WorkoutReconciliationDecision,
  WorkoutReconciliationPreview,
  WorkoutReconciliationPreviewItem,
  WorkoutReviewAction,
  WorkoutReviewSelection,
} from "./types";

type ReviewFilter = "pending" | "all";

const categoryLabel = {
  match: "Match",
  new: "New",
  conflict: "Needs review",
  resolved: "Reviewed",
} as const;

const categoryClassName = {
  match: "bg-green-500/10 text-green-600",
  new: "bg-blue-500/10 text-blue-600",
  conflict: "bg-amber-500/10 text-amber-600",
  resolved: "bg-muted text-muted-foreground",
} as const;

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    return error.response.data.error;
  }
  return "Could not reconcile Apple Health workouts";
}
function formatWorkoutDate(item: WorkoutReconciliationPreviewItem): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(item.healthWorkout.timezone
      ? { timeZone: item.healthWorkout.timezone }
      : {}),
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(
      new Date(item.healthWorkout.startAt),
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(item.healthWorkout.startAt));
  }
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null;
  return `${(meters / 1000).toFixed(2)} km`;
}

function defaultSelections(
  preview: WorkoutReconciliationPreview,
): Record<string, WorkoutReviewSelection> {
  return Object.fromEntries(
    preview.items.map((item) => {
      const candidate = item.candidates[0];
      const action: WorkoutReviewAction =
        item.category === "match"
          ? "link_keep"
          : item.category === "new"
            ? "import_new"
            : "skip";
      return [
        item.healthWorkout.id,
        {
          action,
          activityEntryId: candidate?.activityEntryId,
          activityId: item.suggestedActivity?.id,
        },
      ];
    }),
  );
}

function comparisonText(candidate: TrackingWorkoutCandidate): string | null {
  const comparison = candidate.comparison;
  if (!comparison.compatible || comparison.healthValue == null) return null;
  const healthValue =
    comparison.healthValue >= 10
      ? comparison.healthValue.toFixed(0)
      : comparison.healthValue.toFixed(2);
  const difference =
    comparison.differencePercent == null
      ? ""
      : ` · ${comparison.differencePercent.toFixed(1)}% difference`;
  return `Health ${healthValue} ${comparison.healthUnit} · tracking.so ${comparison.trackingValue} ${comparison.trackingUnit}${difference}`;
}

function proposedChangeLabel(
  action: WorkoutReviewAction,
  candidate: TrackingWorkoutCandidate | undefined,
): string {
  if (action === "link_keep") return "Link and keep tracking.so value";
  if (action === "link_use_health") return "Link and use Health value";
  if (action === "import_new") return "Import as a new timeline workout";
  if (action === "ignore") return "Ignore this Health workout";
  return candidate ? "Decide later" : "Do not import yet";
}

function healthSourceLabel(
  provider: string,
  sourceName: string | null,
): string {
  if (sourceName) return sourceName;
  return provider === "garmin_connect" ? "Garmin Connect" : "Apple Health";
}

export function AppleHealthWorkoutReconciliation({
  enabled,
  openRequestKey,
}: AppleHealthWorkoutReconciliationProps) {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>("pending");
  const [selections, setSelections] = useState<
    Record<string, WorkoutReviewSelection>
  >({});

  const previewQuery = useQuery({
    queryKey: ["apple-health-workout-reconciliation"],
    queryFn: () => getWorkoutReconciliationPreview(api),
    enabled,
  });
  const preview = previewQuery.data;

  useEffect(() => {
    if (preview) setSelections(defaultSelections(preview));
  }, [preview]);

  useEffect(() => {
    if (openRequestKey > 0 && preview?.summary.pending) {
      setFilter("pending");
      setIsOpen(true);
    }
  }, [openRequestKey, preview?.summary.pending]);

  const decisions = useMemo<WorkoutReconciliationDecision[]>(() => {
    if (!preview) return [];
    return preview.items.flatMap((item) => {
      if (item.category === "resolved") return [];
      const selection = selections[item.healthWorkout.id];
      if (!selection || selection.action === "skip") return [];
      return [
        {
          healthWorkoutId: item.healthWorkout.id,
          action: selection.action,
          activityEntryId: selection.activityEntryId,
          activityId: selection.activityId,
        },
      ];
    });
  }, [preview, selections]);

  const applyMutation = useMutation({
    mutationFn: () => applyWorkoutReconciliations(api, decisions),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["apple-health-workout-reconciliation"],
        }),
        queryClient.invalidateQueries({ queryKey: ["apple-health-status"] }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["timeline"] }),
      ]);
      setIsOpen(false);
      toast.success(
        `Workout sync confirmed: ${result.linked} linked, ${result.imported} imported`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!enabled || previewQuery.isLoading) {
    return enabled ? (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking workouts
      </div>
    ) : null;
  }

  if (!preview || preview.summary.total === 0) return null;

  const visibleItems = preview.items.filter(
    (item) => filter === "all" || item.category !== "resolved",
  );

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-500/10 p-2.5 text-red-500">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {preview.summary.pending > 0
                ? "Review imported workouts"
                : "Workouts reviewed"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {preview.summary.pending > 0
                ? "Nothing changes in your timeline until you confirm."
                : `${preview.summary.resolved} Health workouts have a saved decision.`}
            </p>
          </div>
        </div>

        {preview.summary.pending > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-green-500/5 px-2 py-2">
              <p className="font-semibold text-green-600">
                {preview.summary.matches}
              </p>
              <p className="text-[11px] text-muted-foreground">Matches</p>
            </div>
            <div className="rounded-xl bg-blue-500/5 px-2 py-2">
              <p className="font-semibold text-blue-600">
                {preview.summary.newWorkouts}
              </p>
              <p className="text-[11px] text-muted-foreground">New</p>
            </div>
            <div className="rounded-xl bg-amber-500/5 px-2 py-2">
              <p className="font-semibold text-amber-600">
                {preview.summary.conflicts}
              </p>
              <p className="text-[11px] text-muted-foreground">Review</p>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant={preview.summary.pending > 0 ? "default" : "outline"}
          className="mt-3 w-full"
          onClick={() => {
            setFilter(preview.summary.pending > 0 ? "pending" : "all");
            setIsOpen(true);
          }}
        >
          <Eye className="mr-2 h-4 w-4" />
          View all
          <ChevronRight className="ml-auto h-4 w-4" />
        </Button>
      </div>

      <AppleLikePopover
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Review connected workouts"
        className="max-h-[94dvh] sm:max-w-xl"
      >
        <div className="flex max-h-[calc(94dvh-2rem)] min-h-0 flex-col pt-1">
          <div className="shrink-0 px-1 pb-4 pr-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15">
              <HeartPulse className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="mt-3 text-2xl font-bold">Review workout sync</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare every Health workout with your existing timeline. Only the
              selected changes are applied.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
              >
                To review · {preview.summary.pending}
              </Button>
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All · {preview.summary.total}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-4">
            {visibleItems.map((item) => {
              const selection = selections[item.healthWorkout.id] ?? {
                action: "skip",
              };
              const candidate =
                item.candidates.find(
                  (value) =>
                    value.activityEntryId === selection.activityEntryId,
                ) ?? item.candidates[0];
              const healthDistance = formatDistance(
                item.healthWorkout.distanceMeters,
              );
              const comparison = candidate ? comparisonText(candidate) : null;

              return (
                <article
                  key={item.healthWorkout.id}
                  className="rounded-2xl border border-border bg-card p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.healthWorkout.displayName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatWorkoutDate(item)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
                        categoryClassName[item.category],
                      )}
                    >
                      {categoryLabel[item.category]}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                    <div className="rounded-xl bg-red-500/5 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
                        {healthSourceLabel(
                          item.healthWorkout.provider,
                          item.healthWorkout.sourceName,
                        )}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {[
                          healthDistance,
                          formatDuration(item.healthWorkout.durationSeconds),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {item.healthWorkout.sourceName ??
                          item.healthWorkout.deviceName ??
                          "Health"}
                      </p>
                    </div>

                    <div className="flex items-center text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                    </div>

                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        tracking.so
                      </p>
                      {candidate ? (
                        <>
                          <p className="mt-1 truncate text-sm font-medium">
                            {candidate.activityEmoji} {candidate.activityTitle}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {candidate.quantity} {candidate.activityMeasure}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-medium">
                            No existing log
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {item.suggestedActivity
                              ? `Use ${item.suggestedActivity.title}`
                              : "Create a matching activity"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {comparison && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {comparison}
                    </p>
                  )}

                  {item.mismatches.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.mismatches.map((mismatch) => (
                        <span
                          key={mismatch.code}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]",
                            mismatch.severity === "conflict"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : mismatch.severity === "warning"
                                ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {mismatch.severity !== "info" && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {mismatch.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.category === "resolved" && item.resolved ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      Saved decision:{" "}
                      {proposedChangeLabel(item.resolved.action, candidate)}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {item.candidates.length > 1 &&
                        (selection.action === "link_keep" ||
                          selection.action === "link_use_health") && (
                          <Select
                            value={candidate?.activityEntryId}
                            onValueChange={(activityEntryId) =>
                              setSelections((current) => ({
                                ...current,
                                [item.healthWorkout.id]: {
                                  ...selection,
                                  activityEntryId,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose matching log" />
                            </SelectTrigger>
                            <SelectContent>
                              {item.candidates.map((value) => (
                                <SelectItem
                                  key={value.activityEntryId}
                                  value={value.activityEntryId}
                                >
                                  {value.activityEmoji} {value.activityTitle} ·{" "}
                                  {value.quantity} {value.activityMeasure}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                      <Select
                        value={selection.action}
                        onValueChange={(action: WorkoutReviewAction) =>
                          setSelections((current) => ({
                            ...current,
                            [item.healthWorkout.id]: {
                              ...selection,
                              action,
                              activityEntryId:
                                selection.activityEntryId ??
                                item.candidates[0]?.activityEntryId,
                              activityId:
                                selection.activityId ??
                                item.suggestedActivity?.id,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Decide later</SelectItem>
                          {candidate && (
                            <SelectItem value="link_keep">
                              Link · keep tracking.so value
                            </SelectItem>
                          )}
                          {candidate?.comparison.compatible && (
                            <SelectItem value="link_use_health">
                              Link · use Health value
                            </SelectItem>
                          )}
                          <SelectItem value="import_new">
                            Import as a new workout
                          </SelectItem>
                          <SelectItem value="ignore">
                            Ignore this Health workout
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <p className="px-1 text-[11px] text-muted-foreground">
                        Proposed:{" "}
                        {proposedChangeLabel(selection.action, candidate)}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-1 pt-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Unselected workouts stay pending
              </span>
              <span>{decisions.length} changes</span>
            </div>
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={decisions.length === 0 || applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              {applyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Confirm {decisions.length} changes
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
}
