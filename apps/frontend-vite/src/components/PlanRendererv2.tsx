import { useState } from "react";
import { format, isSameWeek } from "date-fns";
import { Flame, Medal, Rocket, Settings2, Sprout } from "lucide-react";
import { useActivities } from "@/contexts/activities/useActivities";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import { CirclePlanSection } from "./circles/CirclePlanSection";
import { SteppedBarProgress } from "./SteppedBarProgress";
import { PlanDrawer } from "./plans/PlanDrawer";
import { PlanWeeks } from "./plans/weeks/PlanWeeks";
import type { PlanProgressStripProps, PlanRendererv2Props } from "./plans/types";

/** This week's days, then habit or lifestyle steps. */
const PlanProgressStrip = ({ plan }: PlanProgressStripProps) => {
  const currentWeek = plan.progress?.weeks?.find((week) => isSameWeek(new Date(week.startDate), new Date()));
  if (!currentWeek || !plan.progress?.achievement) return null;
  const totalPlanned =
    typeof currentWeek.plannedActivities === "number"
      ? currentWeek.plannedActivities
      : (currentWeek.plannedActivities?.length ?? 0);
  const totalCompleted = new Set(
    (currentWeek.completedActivities || []).map((entry: { datetime?: Date | string; date?: Date | string }) =>
      format(new Date(entry.datetime ?? entry.date ?? 0), "yyyy-MM-dd"),
    ),
  ).size;
  const streak = plan.progress.achievement.streak ?? 0;
  const habitAchieved = plan.progress.habitAchievement?.isAchieved || streak >= 4;
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <SteppedBarProgress
        value={totalCompleted}
        maxValue={totalPlanned}
        goal={<Flame size={19} className="text-orange-400" />}
        className="w-full"
        emptyColor="bg-muted/60"
      />
      {!habitAchieved ? (
        <SteppedBarProgress
          value={plan.progress.habitAchievement?.progressValue ?? Math.min(4, streak)}
          maxValue={plan.progress.habitAchievement?.maxValue ?? 4}
          goal={<Sprout size={19} className="text-lime-500" />}
          className="w-full"
          color="bg-lime-400"
          emptyColor="bg-muted/60"
        />
      ) : (
        <SteppedBarProgress
          value={plan.progress.lifestyleAchievement?.progressValue ?? Math.min(9, streak)}
          maxValue={plan.progress.lifestyleAchievement?.maxValue ?? 9}
          goal={<Rocket size={19} className="text-amber-400" />}
          className="w-full"
          color="bg-amber-400"
          emptyColor="bg-muted/60"
        />
      )}
    </div>
  );
};

// The plan page reads top to bottom, as on iPhone: header, progress stepper, this week and next,
// history, circle. Everything else lives in the plan's settings drawer or the Coach tab.
export function PlanRendererv2({ selectedPlan }: PlanRendererv2Props) {
  const { activities, activityEntries } = useActivities();
  const [settings, setSettings] = useState(false);
  const plan = selectedPlan;
  const lifestyle = plan.progress?.lifestyleAchievement?.isAchieved;
  const habit = plan.progress?.habitAchievement?.isAchieved;
  const cadence = [
    plan.outlineType === "TIMES_PER_WEEK" ? `${plan.timesPerWeek} times per week` : "Custom plan",
    plan.finishingDate ? `until ${format(new Date(plan.finishingDate), "MMM d, yyyy")}` : null,
    plan.isPaused ? "paused" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col gap-7" data-testid="plan-detail">
      {plan.backgroundImageUrl && (
        <div className="relative h-48 w-full overflow-hidden rounded-2xl">
          <img src={plan.backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className="text-5xl leading-none">{plan.emoji}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="text-2xl font-semibold leading-tight">{plan.goal}</h2>
          {(lifestyle || habit || plan.visibility === "PRIVATE") && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(lifestyle || habit) && (
                <span
                  className={
                    lifestyle
                      ? "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[13px] font-semibold text-amber-500"
                      : "inline-flex items-center gap-1 rounded-full bg-lime-500/15 px-2.5 py-0.5 text-[13px] font-semibold text-lime-500"
                  }
                >
                  {lifestyle ? <Medal size={16} /> : <Sprout size={16} />}
                  {lifestyle ? "Lifestyle" : "Habit"}
                </span>
              )}
              {plan.visibility === "PRIVATE" && <span className="text-sm text-muted-foreground">Private</span>}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{cadence}</p>
        </div>
        <button
          type="button"
          data-testid="plan-settings-button"
          aria-label="Plan settings"
          onClick={() => setSettings(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Settings2 className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </button>
      </div>

      <PlanProgressStrip plan={plan} />

      <PlanWeeks plan={plan} entries={activityEntries} own />

      <div className="flex flex-col gap-2.5">
        <h3 className="text-lg font-semibold">History</h3>
        <div className="rounded-2xl border border-border p-2">
          <PlanActivityEntriesRenderer plan={plan} activities={activities} activityEntries={activityEntries} />
        </div>
      </div>

      <CirclePlanSection planId={plan.id} />

      <PlanDrawer plan={plan} open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
