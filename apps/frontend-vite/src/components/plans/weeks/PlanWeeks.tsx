import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Dumbbell, Footprints, Gauge, Target } from "lucide-react";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import type { SessionTargets } from "@tsw/prisma/follow-through";
import { dayKind, planDays } from "@tsw/prisma/follow-through/coach-inbox";
import {
  dayNumber,
  liftText,
  longDate,
  paceText,
  unitLabel,
  weekRange,
  weekday,
} from "@tsw/prisma/follow-through/session-format";
import { cn } from "@/lib/utils";
import type { DayTileProps, PlanDay, PlanWeeksProps, SessionTargetRowsProps, TargetRowProps } from "./types";

function TargetRow({ icon: Icon, children }: TargetRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <span className="text-[15px] leading-[21px]">{children}</span>
    </div>
  );
}

/** What a coached session asks for: time, effort, pace (or sets, reps, load) and how you'll know it worked. */
function SessionTargetRows({ targets }: SessionTargetRowsProps) {
  const pace = paceText(targets);
  const lift = liftText(targets);
  return (
    <div className="flex flex-col gap-2.5">
      <TargetRow icon={Clock}>{`${targets.durationMinutes} min`}</TargetRow>
      <TargetRow icon={Gauge}>{targets.effort}</TargetRow>
      {pace && <TargetRow icon={Footprints}>{pace}</TargetRow>}
      {lift && <TargetRow icon={Dumbbell}>{`${targets.exercise ? `${targets.exercise} · ` : ""}${lift}`}</TargetRow>}
      <TargetRow icon={Target}>{targets.progressMeasure}</TargetRow>
    </div>
  );
}

function DayTile({ day, emoji, selected, onClick }: DayTileProps) {
  const kind = dayKind(day);
  const quantity = day.scheduled[0]?.quantity;
  return (
    <button
      type="button"
      data-testid={`plan-day-${day.key}`}
      aria-label={`${longDate(day.key)}, ${kind === "rest" ? "rest day" : kind}`}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-[74px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-card",
        selected ? "border-2 border-primary" : "border border-border",
        day.isPast && !day.logged && "opacity-55",
      )}
    >
      <span className={cn("text-[10px] font-semibold", day.isToday ? "text-primary" : "text-muted-foreground")}>
        {weekday(day.key).toUpperCase()}
      </span>
      <span className={cn("text-[15px] font-bold", day.isToday && "text-primary")}>{dayNumber(day.key)}</span>
      {day.logged && kind !== "rest" ? (
        <span className="text-xs font-bold text-green-500">{emoji} ✓</span>
      ) : kind === "scheduled" ? (
        <span className="text-xs">
          {emoji}
          {quantity ?? ""}
        </span>
      ) : kind === "flexible" ? (
        <span className="text-xs opacity-45">{emoji}</span>
      ) : null}
    </button>
  );
}

// This week and next, the onboarding schedule's layout: tap a day to see what it asks for.
// Same as the iPhone app's plan page.
export function PlanWeeks({ plan, entries, own }: PlanWeeksProps) {
  const navigate = useNavigate();
  const planEntries = useMemo(
    () => entries.filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId)),
    [plan, entries],
  );
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: [plan], entries: planEntries, now: new Date(), weekCount: 2 }),
    [plan, planEntries],
  );
  // Plan sessions carry the coach's title and targets; the projection keeps them.
  const weeks = planDays(projection, planEntries) as PlanDay[][];
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  // A times-per-week plan has no rest days, only days you haven't used yet.
  const kind = dayKind(day) === "rest" && plan.outlineType === "TIMES_PER_WEEK" ? "flexible" : dayKind(day);
  const activityOf = (id?: string) => plan.activities.find((a) => a.id === id) ?? plan.activities[0];
  const emoji = plan.activities[0]?.emoji ?? plan.emoji ?? "•";
  const session = day.scheduled[0];
  const activity = activityOf(session?.activityId ?? day.done[0]?.activityId ?? day.flexible[0]?.activityId);
  const summary = projection.summaries.find((s) => s.weekIndex === (weeks[0].some((d) => d.key === day.key) ? 0 : 1));
  const canLog = own && !!activity && !day.logged && kind !== "rest" && day.key <= projection.todayKey;
  const targets = session?.targets as SessionTargets | null | undefined;
  const title =
    kind === "scheduled"
      ? `${activity?.emoji ?? ""} ${session.title ?? activity?.title ?? "Session"}`
      : kind === "rest"
        ? "Rest day"
        : `${activity?.emoji ?? ""} ${activity?.title ?? ""}`;
  const subtitle =
    kind === "scheduled"
      ? `${longDate(day.key)}${session.quantity ? ` · ${session.quantity} ${unitLabel(activity?.measure ?? "", session.quantity)}` : ""}${day.logged ? " · done" : ""}`
      : kind === "done"
        ? `${longDate(day.key)} · done`
        : kind === "flexible"
          ? `Any day works${summary ? ` · ${summary.remaining} left ${summary.weekIndex ? "next week" : "this week"}` : ""}`
          : longDate(day.key);
  return (
    <div data-testid="plan-weeks" className="flex flex-col gap-3.5">
      {weeks.map((days, index) => (
        <div key={index} className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground">
            {index ? "Next week" : "This week"} · {weekRange(days[0].key)}
          </p>
          <div className="flex gap-[5px]">
            {days.map((d) => (
              <DayTile key={d.key} day={d} emoji={emoji} selected={d.key === day.key} onClick={() => setSelectedKey(d.key)} />
            ))}
          </div>
        </div>
      ))}
      <div data-testid="plan-day-detail" className="flex flex-col gap-3 rounded-[18px] bg-card p-[18px]">
        <div>
          <p className="text-lg font-bold">{title.trim()}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {kind === "scheduled" && targets && <SessionTargetRows targets={targets} />}
        {kind === "scheduled" && session.descriptiveGuide && (
          <p className="text-sm leading-5 text-muted-foreground">{session.descriptiveGuide}</p>
        )}
        {canLog && (
          <button
            type="button"
            onClick={() => navigate({ to: "/add", search: { activityId: activity!.id } })}
            className="min-h-12 rounded-[14px] bg-primary text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Log {activity!.title.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}
