import { type MetricEntry, type ActivityEntry, type Activity } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import React from "react";
import { StoriesContainer } from "./StoriesContainer";
import { YearHeroStory } from "./wrapped/YearHeroStory";
import { WorldMapStory } from "./wrapped/WorldMapStory";
import { SeasonStory } from "./wrapped/SeasonStory";

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
  }>;
  onClose?: () => void;
}

const SEASONS = ["winter", "spring", "summer", "fall"] as const;

export const YearWrapped: React.FC<YearWrappedProps> = ({
  year,
  metricEntries,
  activityEntries,
  activities,
  plans,
  onClose,
}) => {
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

      {/* Stories 3-10: Seasons (2 pages each - photos then graph) */}
      {SEASONS.flatMap((season) => [
        <SeasonStory
          key={`${season}-photos`}
          season={season}
          year={year}
          metricEntries={metricEntries}
          activityEntries={activityEntries}
          activities={activities}
          variant="photos"
        />,
        <SeasonStory
          key={`${season}-graph`}
          season={season}
          year={year}
          metricEntries={metricEntries}
          activityEntries={activityEntries}
          activities={activities}
          variant="graph"
        />,
      ])}
    </StoriesContainer>
  );
};

export default YearWrapped;
