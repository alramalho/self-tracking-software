import type { LucideIcon } from "lucide-react";
import type ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import type { ComponentProps, ReactNode } from "react";

// Mirrors apps/backend-node/src/services/circles/types.ts.
export type CircleStatus = "FORMING" | "ACTIVE";
export type CircleRole = "OWNER" | "MEMBER";
export type MatchReason = "goal" | "pace" | "sameCity" | "timezone" | "age";

export interface MatchPreferences {
  wantsPace: boolean;
  wantsNearby: boolean;
  wantsAge: boolean;
}

export interface ApproxLocation {
  latitude: number;
  longitude: number;
  place?: string;
}

export interface CirclePerson {
  id: string;
  name: string | null;
  username: string | null;
  picture: string | null;
}

export interface CirclePlan {
  id: string;
  goal: string;
  emoji: string | null;
}

export interface CircleCardMember {
  name: string | null;
  goal: string;
  picture: string | null;
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
  // Blurred previews of the latest photos (data URIs), never the photos themselves.
  previews: string[];
  morePhotos: number;
  reasons: MatchReason[];
  members: CircleCardMember[];
}

export type MatchResult =
  | { state: "found"; circle: CircleCard; score: number }
  | { state: "none"; similarPeople: number };

export interface PlanSuggestions {
  plan: CirclePlan;
  circles: CircleCard[];
}

export interface MemberWeek {
  target: number;
  done: number;
  daysLeft: number;
  toGo: number;
  // At their usual pace they won't reach the target this week.
  behind: boolean;
  // Joined after this week started: never counted as behind.
  isNew: boolean;
}

export interface BoardMember {
  user: CirclePerson;
  plan: CirclePlan;
  role: CircleRole;
  joinedAt: string;
  week: MemberWeek;
  hasIntro: boolean;
  // Joined but hasn't posted the first photo log yet; only they can see themselves.
  pending: boolean;
  nudgedToday: boolean;
}

export interface CircleRecap {
  weekStart: string;
  hit: number;
  total: number;
  topName: string | null;
  topCount: number;
}

export interface CircleMe {
  role: CircleRole;
  planId: string;
  hasIntro: boolean;
  // Still needs a first photo log on the circle plan to be in.
  pending: boolean;
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
  me: CircleMe;
  members: BoardMember[];
  togetherStreak: number;
  recap: CircleRecap | null;
}

export interface CircleFeedActivity {
  id: string;
  title: string;
  emoji: string;
  measure: string;
}

export interface CircleFeedReaction {
  id: string;
  emoji: string;
  user: { id: string; username: string };
}

export interface CircleFeedComment {
  id: string;
  text: string;
  createdAt: Date;
  user: { id: string; username: string; picture: string | null };
}

export interface CircleFeedEntry {
  id: string;
  userId: string;
  activityId: string;
  quantity: number;
  datetime: Date;
  createdAt: Date;
  timezone: string | null;
  description: string | null;
  difficulty: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  activity: CircleFeedActivity | null;
  user: CirclePerson;
  reactions: CircleFeedReaction[];
  comments: CircleFeedComment[];
  _count: { comments: number };
}

export interface CircleFeed {
  entries: CircleFeedEntry[];
  introIds: string[];
}

export interface MyCirclePerson {
  name: string | null;
  picture: string | null;
  onTrack: boolean;
  isMe: boolean;
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
  hasIntro: boolean;
  pending: boolean;
  people: MyCirclePerson[];
}

// The circle label the home timeline puts on entries from circle members.
export interface CircleTag {
  id: string;
  name: string;
  emoji: string;
}

// Every circle is open, so the only thing an owner changes is the name.
export interface CircleUpdate {
  name: string;
}

// Joining (or starting) always leaves you pending until your first photo log.
export interface JoinedCircle {
  id: string;
  pending: true;
}

export type PendingMatchMode = "find" | "invite";

// What onboarding hands to the match screen once the plan exists.
export interface PendingMatch extends MatchPreferences {
  planId: string;
  mode: PendingMatchMode;
  location?: ApproxLocation;
}

export interface CircleMatchSearch {
  planId: string;
}

export interface CircleBoardSearch {
  invite?: boolean;
  // Opened right after joining: leaving without logging counts as "Later".
  proof?: boolean;
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

export interface OrbitProps {
  people: OrbitPerson[];
  height?: number;
}

export interface OrbitAvatarProps {
  person: OrbitPerson;
}

export interface WeekDotsProps {
  target: number;
  done: number;
}

export interface MemberRowProps {
  member: BoardMember;
  isMe: boolean;
  onPress?: () => void;
  onNudge?: () => void;
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

// One optional "Match me by" row; Goal is always on and shown locked.
export interface PreferenceChoice {
  key: keyof MatchPreferences;
  icon: LucideIcon;
  title: string;
  detail: string | null;
}

export interface JoinDialogProps {
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

export interface CirclePreviewCardProps {
  circle: MyCircle;
}

export interface CircleTagPillProps {
  circle: CircleTag;
}

export interface ReasonChipsProps {
  reasons: MatchReason[];
}

export type PersonAvatarRing = "on" | "off" | "accent";

export interface PersonAvatarProps {
  name: string | null;
  picture?: string | null;
  size?: number;
  ring?: PersonAvatarRing;
  children?: ReactNode;
}

export interface CirclePanelProps {
  children: ReactNode;
  className?: string;
}

export interface RenameCircleDialogProps {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<unknown>;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface StartCircleInput {
  planId: string;
  preferences: MatchPreferences;
}

export interface JoinCircleInput {
  circleId: string;
  planId: string;
  preferences: MatchPreferences;
}

export interface JoinByInviteInput {
  code: string;
  planId: string;
  preferences: MatchPreferences;
}

export interface UpdateCircleInput {
  circleId: string;
  changes: CircleUpdate;
}

export interface CircleMemberInput {
  circleId: string;
  userId: string;
}

export interface LoadErrorProps {
  message: string;
  retry: () => void;
}

export interface CircleFeedListProps {
  circleId: string;
}

// The timeline photo card, reused for the circle's "Latest" feed.
export type PhotoCardProps = ComponentProps<typeof ActivityEntryPhotoCard>;

export interface CircleAskOption {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

export interface CircleAskProps {
  busy: boolean;
  onFind: () => void;
  onInvite: () => void;
  onSolo: () => void;
}

export interface CirclePrefsProps extends MatchPreferencesListProps {
  locating: boolean;
  locationDenied: boolean;
  onAge: (age: number) => void;
}

export interface CircleChat {
  chatId: string;
}

export interface OpenSpotsProps {
  // How many people are in the circle now.
  members: number;
}
