import type { ReactNode, RefObject } from "react";
import type { View, TextProps, ViewStyle } from "react-native";
import type {
  Activity,
  ActivityEntry,
  MetricEntry,
  Plan,
  User,
} from "@/core/types";
export interface WrappedData {
  year: number;
  entries: ActivityEntry[];
  metrics: MetricEntry[];
  activities: Activity[];
  plans: Plan[];
  user: User;
  friends: FriendScore[];
  self: FriendScore;
  annualPlans: YearPlanStats[];
}
export interface YearPlanStats {
  id: string;
  peakStreak: number;
  habitEarned: boolean;
  lifestyleEarned: boolean;
}
export interface WrappedLeaderboard {
  year: number;
  timezone: "UTC";
  people: (FriendScore & { id: string })[];
  plans: YearPlanStats[];
}
export interface FriendScore {
  totalActivitiesLogged?: number;
  username: string;
  name?: string | null;
  picture?: string | null;
  totalPoints: number;
  bestStreak: number;
}
export interface CountryCount {
  code: string;
  name: string;
  count: number;
}
export interface ActivityTotal {
  activity: Activity;
  days: number;
  quantity: number;
  count: number;
}
export interface MoodPeriod {
  label: string;
  index: number;
  average: number;
  count: number;
  percentDiff: number;
}
export interface StoryFrameProps {
  children: ReactNode;
  accent?: string;
  center?: boolean;
  captureRef?: RefObject<View | null>;
}
export interface StoryTextProps extends TextProps {
  muted?: boolean;
  size?: number;
  title?: boolean;
}
export interface StoryPanelProps {
  children: ReactNode;
  style?: ViewStyle;
}
export interface StatsProps {
  items: { value: string | number; label: string }[];
}
export interface PodiumItem {
  id: string;
  emoji?: string;
  picture?: string | null;
  name?: string | null;
  color?: string;
}
export interface PodiumProps {
  items: PodiumItem[];
  onPress?: (id: string) => void;
}
export interface PhotoPreviewProps {
  entry?: ActivityEntry;
  activity?: Activity;
  onClose: () => void;
}
export interface JourneyLine {
  id: string;
  emoji: string;
  color: string;
  points: { day: number; value: number }[];
}
export interface JourneyData {
  days: Date[];
  lines: JourneyLine[];
  photos: { entry: ActivityEntry; day: number }[];
}
export type StoryId =
  | "hero"
  | "world"
  | "journey"
  | "plans"
  | "mood"
  | "activities"
  | "friends"
  | "streaks";
export interface LeaderboardProps {
  data: WrappedData;
  streaks?: boolean;
}
export interface ShareStoryInput {
  view: RefObject<View | null>;
  year: number;
}
export interface StoryProps {
  data: WrappedData;
}
export interface MapPathsProps {
  countries: CountryCount[];
  selected?: string;
  onSelect: (code: string) => void;
}

export interface StoryRevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  rise?: number;
  height?: number;
  testID?: string;
  style?: import("react-native").StyleProp<ViewStyle>;
}
