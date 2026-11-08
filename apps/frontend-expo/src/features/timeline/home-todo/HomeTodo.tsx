import { useMemo, useState } from "react";
import { View } from "react-native";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays, homeProgress } from "@tsw/prisma/home-todo";
import { Heading, useColors } from "@/components/ui";
import { useFollowThrough } from "@/features/follow-through/api";
import { visibleSessions } from "@/features/follow-through/model";
import { CoachNote } from "./CoachNote";
import { DayDetail, TwoWeeks } from "./Days";
import { HomeProgress } from "./HomeProgress";
import type { HomeTodoProps } from "./types";

/** Top of the homepage: the coach's note when it matters, then what's on this week and next. */
export function HomeTodo({ plans, entries }: HomeTodoProps) {
  const c = useColors();
  const visible = useMemo(() => {
    const now = new Date();
    return plans.filter(
      (plan) => !plan.isPaused && (!plan.finishingDate || new Date(plan.finishingDate) >= now),
    );
  }, [plans]);
  const logs = useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);
  const state = useFollowThrough().data?.state;
  const practice = useMemo(() => visibleSessions({ state, plans: visible }), [state, visible]);
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: visible, entries: logs, now: new Date(), weekCount: 2 }),
    [visible, logs],
  );
  const weeks = useMemo(
    () => homeDays({ projection, plans: visible, entries: logs, practice }),
    [projection, visible, logs, practice],
  );
  const progress = useMemo(() => homeProgress({ projection, plans: visible, entries: logs }), [projection, visible]);
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  return (
    <View testID="home-todo" style={{ gap: 12 }}>
      <CoachNote />
      {!!visible.length && (
        <View style={{ gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.card }}>
          <Heading>Soon</Heading>
          <TwoWeeks weeks={weeks} selectedKey={day.key} onSelect={setSelectedKey} />
          <HomeProgress rows={progress} />
          <DayDetail day={day} todayKey={projection.todayKey} />
        </View>
      )}
    </View>
  );
}
