import { useMemo, useState } from "react";
import { Clock, Dumbbell, Footprints, Gauge, Target } from "lucide-react";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import type { SessionTargets } from "@tsw/prisma/follow-through";
import { planDays } from "@tsw/prisma/follow-through/coach-inbox";
import { homeDays } from "@tsw/prisma/home-todo";
import { DayDetail, TwoWeeks } from "@/components/home-todo/Days";
import { liftText, paceText } from "@tsw/prisma/follow-through/session-format";
import type { PlanDay, PlanWeeksProps, SessionTargetRowsProps, TargetRowProps } from "./types";

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

// This week and next for one plan: the homepage's tiles and rows, plus the coach's targets for a session.
// Same as the iPhone app's plan page.
export function PlanWeeks({ plan, entries }: PlanWeeksProps) {
  const planEntries = useMemo(
    () => entries.filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId)),
    [plan, entries],
  );
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: [plan], entries: planEntries, now: new Date(), weekCount: 2 }),
    [plan, planEntries],
  );
  const weeks = useMemo(
    () => homeDays({ projection, plans: [plan], entries: planEntries }),
    [projection, plan, planEntries],
  );
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  // Plan sessions carry the coach's targets and guide; the projection keeps them.
  const session = (planDays(projection, planEntries) as PlanDay[][]).flat().find((d) => d.key === day.key)?.scheduled[0];
  const targets = session?.targets as SessionTargets | null | undefined;
  return (
    <div data-testid="plan-weeks" className="flex flex-col gap-3">
      <TwoWeeks weeks={weeks} selectedKey={day.key} onSelect={setSelectedKey} testPrefix="plan-day" />
      <DayDetail day={day} todayKey={projection.todayKey} testId="plan-day-detail">
        {targets && <SessionTargetRows targets={targets} />}
        {session?.descriptiveGuide && <p className="pb-1 text-sm leading-5 text-muted-foreground">{session.descriptiveGuide}</p>}
      </DayDetail>
    </div>
  );
}
