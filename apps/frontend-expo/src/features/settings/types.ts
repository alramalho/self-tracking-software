import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
export type SettingsView =
  | "main"
  | "profile"
  | "accounts"
  | "appearance"
  | "integrations"
  | "coach"
  | "experience"
  | "appleHealth"
  | "garmin"
  | "privacy"
  | "blocked";
export interface SettingsRowProps {
  icon?: LucideIcon;
  title: string;
  onPress?: () => void;
  selected?: boolean;
  /** Current value, shown muted before the chevron (e.g. "Dark · Amber"). */
  value?: string;
  /** Replaces the chevron, e.g. a Switch. */
  trailing?: ReactNode;
  /** Rows that open another screen show a chevron. */
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}
export interface SettingsGroupProps {
  title?: string;
  /** Small print under the group, like iOS Settings footers. */
  footer?: string;
  /** Where row dividers start; 0 for rows without a leading icon. */
  separatorInset?: number;
  children: ReactNode;
  testID?: string;
}
export interface CoachDetails {
  title: string;
  bio: string;
  focusDescription: string;
  idealPlans: { emoji: string; title: string }[];
  introVideoUrl?: string;
}
export interface CoachProfile {
  id: string;
  details: CoachDetails;
}

export interface AppearanceProps {
  selected?: string;
  busy: boolean;
  onSelect: (value: string) => void;
}
export interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  iconBackground?: boolean;
  color?: string;
  onPress?: () => void;
  trailing?: import("react").ReactNode;
  children?: import("react").ReactNode;
  disabled?: boolean;
}
export interface ProfileSettingsProps {
  onBusyChange: (busy: boolean) => void;
}
export type ProfileField =
  | "name"
  | "age"
  | "description"
  | "reactionEmojis"
  | "delete";
export interface ProfileCardProps {
  name?: string | null;
  username?: string | null;
  picture?: string | null;
  planType?: string | null;
  onPress: () => void;
}
