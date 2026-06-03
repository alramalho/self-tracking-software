import { Button } from "@/components/ui/button";
import { usePlans } from "@/contexts/plans";
import { cn } from "@/lib/utils";
import { type PlanMilestone } from "@tsw/prisma/types";
import { format, isBefore, startOfToday } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface MilestoneOverviewProps {
  milestones: PlanMilestone[];
  planId?: string;
  onEdit?: () => void;
}

function getProgress(milestone: PlanMilestone): number {
  return Math.min(Math.max(milestone.progress ?? 0, 0), 100);
}

function getCriteriaText(criteria: unknown): string | null {
  if (!criteria) return null;
  if (typeof criteria === "string") return criteria;
  if (typeof criteria === "object") return JSON.stringify(criteria);
  return null;
}

export const MilestoneOverview: React.FC<MilestoneOverviewProps> = ({
  milestones,
  onEdit,
}) => {
  const { modifyManualMilestone, isModifyingManualMilestone } = usePlans();
  const [isExpanded, setIsExpanded] = useState(false);
  const sortedMilestones = useMemo(
    () =>
      [...milestones].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [milestones]
  );
  const completedCount = sortedMilestones.filter(
    (milestone) => getProgress(milestone) >= 100
  ).length;
  const currentMilestone =
    sortedMilestones.find((milestone) => getProgress(milestone) < 100) ??
    sortedMilestones[sortedMilestones.length - 1];
  const visibleMilestones = isExpanded
    ? sortedMilestones
    : currentMilestone
      ? [currentMilestone]
      : [];

  if (sortedMilestones.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Milestones
            </h3>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{sortedMilestones.length} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {sortedMilestones.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              aria-label={
                isExpanded ? "Collapse milestones" : "Expand milestones"
              }
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label="Edit milestones"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {visibleMilestones.map((milestone) => {
          const progress = getProgress(milestone);
          const isComplete = progress >= 100;
          const isPastDue =
            !isComplete && isBefore(new Date(milestone.date), startOfToday());
          const criteriaText = getCriteriaText(milestone.criteria);

          return (
            <div key={milestone.id} className="flex gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  isComplete
                    ? "border-green-500/40 bg-green-500/10 text-green-600"
                    : isPastDue
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {milestone.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(milestone.date), "EEE, MMM d")}
                      {isPastDue ? " · past due" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {progress}%
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isComplete ? "bg-green-500" : "bg-primary"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  {criteriaText ? (
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      {criteriaText}
                    </p>
                  ) : (
                    <span />
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isModifyingManualMilestone || progress <= 0}
                      onClick={() =>
                        modifyManualMilestone({
                          milestoneId: milestone.id,
                          delta: -10,
                        })
                      }
                      aria-label="Decrease milestone progress"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isModifyingManualMilestone || progress >= 100}
                      onClick={() =>
                        modifyManualMilestone({
                          milestoneId: milestone.id,
                          delta: 10,
                        })
                      }
                      aria-label="Increase milestone progress"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
