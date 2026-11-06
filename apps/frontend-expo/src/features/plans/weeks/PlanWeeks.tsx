import { useMemo, useState } from "react";
import { View } from "react-native";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { homeDays } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { SessionTargetRows } from "@/features/plans/SessionTargetRows";
import { useFollowThrough } from "@/features/follow-through/api";
import { visibleSessions } from "@/features/follow-through/model";
import { DayDetail, TwoWeeks } from "@/features/timeline/home-todo/Days";
import { planDays } from "./model";
import type { PlanDay, PlanWeeksProps } from "./types";

// This week and next for one plan: the homepage's tiles and rows, plus the coach's targets for a session.
export function PlanWeeks({ plan, entries }: PlanWeeksProps) {
  const c = useColors();
  const planEntries = useMemo(
    () => entries.filter((entry) => !entry.deletedAt && plan.activities.some((a) => a.id === entry.activityId)),
    [plan, entries],
  );
  const projection = useMemo(
    () => buildPlanWeekProjection({ plans: [plan], entries: planEntries, now: new Date(), weekCount: 2 }),
    [plan, planEntries],
  );
  const state = useFollowThrough().data?.state;
  const practice = useMemo(() => visibleSessions({ state, plans: [plan] }), [state, plan]);
  const weeks = useMemo(
    () => homeDays({ projection, plans: [plan], entries: planEntries, practice }),
    [projection, plan, planEntries, practice],
  );
  const [selectedKey, setSelectedKey] = useState(projection.todayKey);
  const day = weeks.flat().find((d) => d.key === selectedKey) ?? weeks[0][0];
  // Plan sessions carry the coach's targets and guide; the projection keeps them.
  const session = (planDays(projection, planEntries) as PlanDay[][]).flat().find((d) => d.key === day.key)?.scheduled[0];
  return (
    <View testID="plan-weeks" style={{ gap: 12 }}>
      <TwoWeeks weeks={weeks} selectedKey={day.key} onSelect={setSelectedKey} testPrefix="plan-day" />
      <DayDetail day={day} todayKey={projection.todayKey} testID="plan-day-detail">
        {!!session?.targets && <SessionTargetRows targets={session.targets} />}
        {!!session?.descriptiveGuide && (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, paddingBottom: 4 }}>{session.descriptiveGuide}</Text>
        )}
      </DayDetail>
    </View>
  );
}
