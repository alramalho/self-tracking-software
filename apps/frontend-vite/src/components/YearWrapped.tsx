import { type MetricEntry, type ActivityEntry, type Activity, type PlanType } from "@tsw/prisma";
import { type PlanProgressData } from "@tsw/prisma/types";
import React, { useMemo } from "react";
import { StoriesContainer } from "./StoriesContainer";
import { YearHeroStory } from "./wrapped/YearHeroStory";
import { WorldMapStory } from "./wrapped/WorldMapStory";
import { YearJourneyGraphStory } from "./wrapped/YearJourneyGraphStory";
import { PlansAchievementStory } from "./wrapped/PlansAchievementStory";
import { MoodInsightsStory } from "./wrapped/MoodInsightsStory";
import { YearInNumbersStory } from "./wrapped/YearInNumbersStory";
import { FriendsLeaderboardStory, computeFriendScore, type FriendScore } from "./wrapped/FriendsLeaderboardStory";
import { StreakLeaderboardStory } from "./wrapped/StreakLeaderboardStory";

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
  user: { username: string; name: string; picture: string; planType: PlanType };
  friendScores?: FriendScore[];
  onClose?: () => void;
}

export const YearWrapped: React.FC<YearWrappedProps> = ({
  year,
  metricEntries,
  activityEntries,
  activities,
  plans,
  user,
  friendScores,
  onClose,
}) => {
  const yearActivityEntries = useMemo(() => {
    return activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year
    );
  }, [activityEntries, year]);

  const currentUserScore: FriendScore = useMemo(() => {
    const { totalPoints, bestStreak } = computeFriendScore(activityEntries, plans);
    return {
      username: user.username,
      name: user.name,
      picture: user.picture,
      totalPoints,
      bestStreak,
    };
  }, [user, activityEntries, plans]);

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

      {/* Plans Achievement */}
      {plans.length > 0 && (
        <PlansAchievementStory
          year={year}
          plans={plans}
          activityEntries={activityEntries}
        />
      )}

      {/* Mood Insights */}
      <MoodInsightsStory
        year={year}
        metricEntries={metricEntries}
      />

      {/* Activity totals */}
      <YearInNumbersStory
        year={year}
        activityEntries={activityEntries}
        activities={activities}
      />

      {/* Friends Leaderboard - by points */}
      {friendScores && friendScores.length > 0 && (
        <FriendsLeaderboardStory
          year={year}
          friends={friendScores}
          currentUser={currentUserScore}
        />
      )}

      {/* Friends Leaderboard - by streaks */}
      {friendScores && friendScores.length > 0 && (
        <StreakLeaderboardStory
          year={year}
          friends={friendScores}
          currentUser={currentUserScore}
        />
      )}
    </StoriesContainer>
  );
};

export default YearWrapped;
