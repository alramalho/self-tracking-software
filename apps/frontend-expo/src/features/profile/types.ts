import type { Activity, Plan, User } from "@/core/types";
import type { FeedItem } from "../timeline/types";
export interface ProfileScreenProps {
  username?: string;
}
export interface ProfileHeaderProps {
  user: User;
  own: boolean;
  current?: User;
}
export interface AchievementBadgeProps {
  kind: "streaks" | "habits" | "lifestyles";
  count: number;
  onPress: () => void;
}
export type ProfileRow =
  | { id: string; type: "plan"; plan: Plan }
  | { id: string; type: "unplanned"; activities: Activity[] }
  | { id: string; type: "history"; item: FeedItem };
export type ProfileDetail =
  | "points"
  | "friends"
  | "streaks"
  | "habits"
  | "lifestyles";
export interface RankedUser {
  rank: number;
  username: string;
  name?: string | null;
  picture?: string | null;
  totalPoints: number;
  bestStreak: number;
}
export interface RankingsResponse {
  pointsRanking: RankedUser[];
  streaksRanking: RankedUser[];
  currentUser: {
    pointsRank: number | null;
    streaksRank: number | null;
    totalPoints: number;
    bestStreak: number;
  };
}
