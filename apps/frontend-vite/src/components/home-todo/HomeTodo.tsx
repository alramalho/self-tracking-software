import { useMemo, useState } from "react";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays, homeProgress } from "@tsw/prisma/home-todo";
import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";
import { CoachNote } from "./CoachNote";
import { DayDetail, TwoWeeks } from "./Days";
import { HomeProgress } from "./HomeProgress";

/** Top of the homepage: the coach's note when it matters, then what's on this week and next. Same as the iPhone app. */
export const HomeTodo = () => {
  const { plans } = usePlans();
  const { activityEntries } = useActivities();
  const visible = useMemo(() => {
    const now = new Date();
    return (plans ?? []).filter(
      (plan) =>
        !plan.deletedAt &&
        !plan.archivedAt &&
        !plan.isPaused &&
        (!plan.finishingDate || new Date(plan.finishingDate) >= now),
    );
  }, [plans]);
  const logs = useMemo(() => (activityEntries ?? []).filter((entry) => !entry.deletedAt), [activityEntries]);
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: visible, entries: logs, now: new Date(), weekCount: 2 }),
    [visible, logs],
  );
  const weeks = useMemo(() => homeDays({ projection, plans: visible, entries: logs }), [projection, visible, logs]);
  const progress = useMemo(() => homeProgress({ projection, plans: visible, entries: logs }), [projection, visible]);
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  return (
    <div data-testid="home-todo" className="flex flex-col gap-3">
      <CoachNote />
      {visible.length > 0 && (
        <section className="flex flex-col gap-3.5 rounded-3xl bg-card p-4">
          <h2 className="text-[19px] font-bold">Soon</h2>
          <TwoWeeks weeks={weeks} selectedKey={day.key} onSelect={setSelectedKey} />
          <HomeProgress rows={progress} />
          <DayDetail day={day} todayKey={projection.todayKey} />
        </section>
      )}
    </div>
  );
};
