import type { ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { ActivityEntry, Person } from "@/core/types";

// Mirrors apps/backend-node/src/services/circles/types.ts.
export type CircleStatus = "FORMING" | "ACTIVE";
export type CircleRole = "OWNER" | "MEMBER";
export type MatchReason = "goal" | "pace" | "sameCity" | "timezone" | "age";

export interface MatchPreferences {
  wantsPace: boolean;
  wantsNearby: boolean;
  wantsAge: boolean;
}

export interface CircleCard {
  id: string;
  name: string;
  emoji: string;
  status: CircleStatus;
  place: string | null;
  memberCount: number;
  paceLabel: string | null;
  logsThisWeek: number;
  previews: string[];
  morePhotos: number;
  reasons: MatchReason[];
  members: { name: string | null; goal: string; picture: string | null }[];
}

export type MatchResult =
  | { state: "found"; circle: CircleCard; score: number }
  | { state: "none"; similarPeople: number };

export interface PlanSuggestions {
  plan: { id: string; goal: string; emoji: string | null };
  circles: CircleCard[];
}

export interface MemberWeek {
  target: number;
  done: number;
  daysLeft: number;
  toGo: number;
  behind: boolean;
  isNew: boolean;
}

export interface BoardMember {
  user: Person;
  plan: { id: string; goal: string; emoji: string | null };
  role: CircleRole;
  joinedAt: string;
  week: MemberWeek;
  hasIntro: boolean;
  // Joined but no first photo log yet; only they see themselves.
  pending: boolean;
  nudgedToday: boolean;
}

export interface WeekChip {
  done: number;
  target: number;
}

export interface PastWeekPerson {
  userId: string;
  done: number;
  target: number;
  hit: boolean;
}

// Finished weeks (oldest first) and each person's share of their own target.
export interface PastWeeks {
  weeks: { start: string; allHit: boolean; people: PastWeekPerson[] }[];
  // `hits` lines up with `weeks`; null for weeks before they joined.
  ranking: { userId: string; percent: number; rank: number; hits: (boolean | null)[] }[];
}

// One bar in the past-weeks chart: a finished week, or the week in progress.
export interface WeekBar {
  key: string;
  label: string;
  current: boolean;
  allHit: boolean;
  target: number;
  segments: { userId: string; done: number }[];
}

export interface CircleBoard {
  id: string;
  name: string;
  emoji: string;
  status: CircleStatus;
  inviteCode: string;
  openToMatching: boolean;
  discoverable: boolean;
  place: string | null;
  paceLabel: string | null;
  cap: number;
  // The owner's switch for Helly's recap and halfway check in the chat.
  coachPosts: boolean;
  me: { role: CircleRole; planId: string; hasIntro: boolean; pending: boolean; muted: boolean };
  members: BoardMember[];
  togetherStreak: number;
  pastWeeks: PastWeeks | null;
}

export interface CircleFeed {
  entries: (ActivityEntry & {
    user: Person;
    activity: { id: string; title: string; emoji: string; measure: string } | null;
  })[];
  introIds: string[];
}

export interface MyCircle {
  id: string;
  name: string;
  emoji: string;
  status: CircleStatus;
  planId: string;
  memberCount: number;
  onTrack: number;
  daysLeft: number;
  pending: boolean;
  hasIntro: boolean;
  people: { name: string | null; picture: string | null; onTrack: boolean; isMe: boolean }[];
}

export interface CircleIntroHintProps {
  activityId: string;
}

// What onboarding hands to the match screen once the plan exists.
export interface PendingMatch extends MatchPreferences {
  planId: string;
  mode: "find" | "invite";
  location?: { latitude: number; longitude: number; place?: string };
}

export interface OrbitPerson {
  key: string;
  label: string;
  color: string;
  picture?: string | null;
  isMe?: boolean;
  empty?: boolean;
}

export interface OrbitEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface OrbitPersonViewProps {
  person: OrbitPerson;
  index: number;
  slots: number;
  small: boolean;
  turn: SharedValue<number>;
  ellipse: OrbitEllipse;
}

export interface OrbitProps {
  people: OrbitPerson[];
  height?: number;
  // The whole ellipse, sized to its container, instead of the wide arc used in onboarding.
  ring?: boolean;
}

export interface PastWeeksRowProps {
  board: CircleBoard;
  viewerId: string | undefined;
  onPress: () => void;
}

export interface PastWeeksSheetProps {
  board: CircleBoard;
  viewerId: string | undefined;
  visible: boolean;
  onClose: () => void;
}

export interface PastWeeksChartProps {
  bars: WeekBar[];
  colors: Record<string, string>;
  // When set, everyone else's slices dim.
  highlight: string | undefined;
}

export interface WeekChipPillProps {
  chip: WeekChip;
}

export interface WeekDotsProps {
  target: number;
  done: number;
}

export interface MemberRowProps {
  member: BoardMember;
  isMe: boolean;
  onPress?: () => void;
  onMotivate?: () => void;
}

export interface CircleCardViewProps {
  card: CircleCard;
  onPress: () => void;
}

export interface MatchPreferencesListProps {
  value: MatchPreferences;
  onChange: (value: MatchPreferences) => void;
  place: string | null;
  age: number | null | undefined;
  weeklyTarget: number;
}

export interface JoinSheetProps {
  card: CircleCard | null;
  inviteCode?: string;
  onClose: () => void;
  onJoined: (circleId: string) => void;
}

export interface CirclePickerProps {
  onPick: (card: CircleCard) => void;
}

export interface CircleSearchResultsProps extends CirclePickerProps {
  query: string;
}

export interface CirclePlanSectionProps {
  planId: string;
}

export interface OpenSpotsProps {
  // People already in the circle, proven or not.
  members: number;
}

export interface ReasonChipsProps {
  reasons: MatchReason[];
}

export interface PersonAvatarProps {
  name: string | null;
  picture?: string | null;
  size?: number;
  ring?: "on" | "off" | "accent";
  children?: ReactNode;
}

export interface MotivateDrawerProps {
  circleId: string;
  member: BoardMember;
  onClose: () => void;
}
