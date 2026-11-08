import { CalendarGrid } from "@/components/CalendarGrid";
import { CoachUpgradeCard } from "@/components/home-cards/CoachUpgradeCard";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { usePlans } from "@/contexts/plans";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { computeGridCells, isActiveVisiblePlan } from "@/utils/ghostGrid";
import {
  isDailyCheckinDue,
  plansNeedingDecision,
} from "@tsw/prisma/home-todo";
import { useNavigate } from "@tanstack/react-router";
import { isSameDay, subDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { CoachNote } from "./CoachNote";
import type { HomeTodoProps, HomeTodoRow, HomeTodoRowsProps } from "./types";

const UNORDERED_PLAN_SORT = Number.MAX_SAFE_INTEGER;

/** Settings-style rows: emoji, **Title** · value, chevron. */
const HomeTodoRows = ({ rows }: HomeTodoRowsProps) => (
  <div
    data-testid="home-todo-rows"
    className="overflow-hidden rounded-[20px] bg-card"
  >
    {rows.map((row, index) => (
      <button
        key={row.id}
        type="button"
        aria-label={`${row.title} · ${row.value}`}
        onClick={row.onClick}
        className={`flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-left ${
          index ? "border-t border-border" : ""
        }`}
      >
        <span className="text-[25px] leading-none">{row.icon}</span>
        <span className="flex-1 text-base font-semibold text-foreground">
          {row.title}
          <span
            className={
              row.attention
                ? "font-semibold text-primary"
                : "font-normal text-muted-foreground"
            }
          >
            {" "}
            · {row.value}
          </span>
        </span>
        {row.attention && <span className="h-2 w-2 rounded-full bg-primary" />}
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
      </button>
    ))}
  </div>
);

/** Top of the homepage: what is left to do this week and next, at a glance. */
export const HomeTodo = ({ onOpenMetricsLog }: HomeTodoProps) => {
  const { plans } = usePlans();
  const { activityEntries, isLoadingActivityEntries } = useActivities();
  const { metrics, entries: metricEntries } = useMetrics();
  const { userPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const navigate = useNavigate();
  const now = new Date();

  const orderedPlans = useMemo(
    () =>
      (plans ?? [])
        .filter((plan) => plan.deletedAt === null && !plan.archivedAt)
        .sort(
          (a, b) =>
            (a.sortOrder ?? UNORDERED_PLAN_SORT) -
              (b.sortOrder ?? UNORDERED_PLAN_SORT) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [plans]
  );
  const scheduledPlans = useMemo(
    () => orderedPlans.filter(isActiveVisiblePlan),
    [orderedPlans]
  );
  const gridData = useMemo(
    () => computeGridCells(scheduledPlans, new Date(), activityEntries || []),
    [scheduledPlans, activityEntries]
  );
  const isCompletedOnDay = (activityId: string, day: Date) =>
    (activityEntries || []).some(
      (entry) =>
        entry.activityId === activityId &&
        isSameDay(new Date(entry.datetime), day)
    );

  const rows: HomeTodoRow[] = plansNeedingDecision(orderedPlans, now).map(
    (plan) => ({
      id: plan.planId,
      icon: plan.emoji || "📋",
      title: plan.goal,
      value:
        plan.reason === "ended" ? "Ended" : "No sessions left",
      attention: true,
      onClick: () =>
        navigate({ to: "/plans", search: { selectedPlan: plan.planId } }),
    })
  );
  if (
    userPlanType !== "FREE" &&
    isDailyCheckinDue(metrics ?? [], metricEntries ?? [], now)
  ) {
    rows.push({
      id: "daily-checkin",
      icon: "📊",
      title: "Daily check-in",
      value: "Not logged today",
      onClick: onOpenMetricsLog,
    });
  }

  const recentActivityCount = activityEntries.filter(
    (entry) => new Date(entry.datetime) >= subDays(now, 30)
  ).length;
  const showUpgrade =
    userPlanType === "FREE" &&
    !isLoadingActivityEntries &&
    recentActivityCount <= 5;

  return (
    <div data-testid="home-todo" className="space-y-3">
      <CoachNote />
      {scheduledPlans.length > 0 && (
        <section className="space-y-3.5 rounded-3xl bg-card p-4 ring-1 ring-border">
          <h2 className="text-[19px] font-bold text-foreground">
            Next two weeks
          </h2>
          <CalendarGrid
            sessions={gridData.scheduledSessions}
            activities={gridData.activities}
            ghostCells={gridData.ghostCells}
            isCompletedOnDay={isCompletedOnDay}
            showLegend={false}
            weekLabels={{ week1: "This week", week2: "Next week" }}
            selectedSessionDisplay="card"
            allDaysSelectable
          />
        </section>
      )}
      {rows.length > 0 && <HomeTodoRows rows={rows} />}
      {showUpgrade && (
        <CoachUpgradeCard
          onOpenUpgrade={() => setShowUpgradePopover(true)}
          recentActivityCount={recentActivityCount}
        />
      )}
    </div>
  );
};
