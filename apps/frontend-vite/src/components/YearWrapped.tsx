import { type MetricEntry, type ActivityEntry, type Activity } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import React, { useMemo } from "react";
import { StoriesContainer } from "./StoriesContainer";
import { YearHeroStory } from "./wrapped/YearHeroStory";
import { WorldMapStory } from "./wrapped/WorldMapStory";
import { YearJourneyGraphStory } from "./wrapped/YearJourneyGraphStory";
import { PlanBreakdownStory } from "./wrapped/PlanBreakdownStory";
import { MoodInsightsStory } from "./wrapped/MoodInsightsStory";

interface YearWrappedProps {
  year: number;
  metricEntries: MetricEntry[];
  activityEntries: ActivityEntry[];
  activities: Activity[];
  plans: Array<{
    id: string;
    emoji: string | null;
    goal: string;
    progress: PlanProgressData;
    activities: Activity[];
  }>;
  onClose?: () => void;
}

export const YearWrapped: React.FC<YearWrappedProps> = ({
  year,
  metricEntries,
  activityEntries,
  activities,
  plans,
  onClose,
}) => {
  const qualifyingPlans = useMemo(() => {
    return plans.filter(
      (p) =>
        p.progress?.habitAchievement?.isAchieved ||
        p.progress?.lifestyleAchievement?.isAchieved
    );
  }, [plans]);

  const yearActivityEntries = useMemo(() => {
    return activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year
    );
  }, [activityEntries, year]);

  return (
    <StoriesContainer onClose={onClose}>
      {/* Story 1: Year Hero */}
      <YearHeroStory
        year={year}
        activityEntries={activityEntries}
        plans={plans}
      />

      {/* Story 2: World Map */}
      <WorldMapStory
        year={year}
        activityEntries={activityEntries}
      />

      {/* Story 3: Year Journey Graph */}
      <YearJourneyGraphStory
        year={year}
        metricEntries={metricEntries}
        activityEntries={activityEntries}
        activities={activities}
      />

      {/* Plan Breakdown stories */}
      {qualifyingPlans.map((plan, idx) => (
        <PlanBreakdownStory
          key={plan.id}
          plan={plan}
          activityEntries={yearActivityEntries}
          colorIndex={idx}
        />
      ))}

      {/* Mood Insights */}
      <MoodInsightsStory
        year={year}
        metricEntries={metricEntries}
      />
    </StoriesContainer>
  );
};

export default YearWrapped;
