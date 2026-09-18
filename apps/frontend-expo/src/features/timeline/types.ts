import type { Activity, ActivityEntry, Achievement, User } from "@/core/types";
export interface FeedItem {
  id: string;
  date: number;
  entry?: ActivityEntry;
  achievement?: Achievement;
  user?: User;
  activity?: Activity;
  sharedEntries?: FeedItem[];
}
export interface FeedCardProps {
  item: FeedItem;
  compactInitially?: boolean;
  highlighted?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}
export interface PhotoGridProps {
  photos: string[];
  title: string;
}
export interface AchievementEditorProps {
  post: Achievement;
  onClose: () => void;
}
export interface TimelineRow {
  id: string;
  item?: FeedItem;
  secondary?: FeedItem;
  compact?: boolean;
}

export interface PhotoViewerProps {
  nativeToolbar?: boolean;
  uri?: string;
  onClose: () => void;
}

export interface ActivitySummaryProps {
  item: FeedItem;
  compact?: boolean;
}

export interface ParticipantAvatarProps {
  user?: User;
  size?: number;
}

export interface FeedCaptionProps {
  text: string;
  overlay?: boolean;
}
