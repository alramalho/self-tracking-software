import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react-native";
export type SettingsView =
  | "main"
  | "profile"
  | "palette"
  | "theme"
  | "integrations"
  | "coach"
  | "experience"
  | "apiKeys"
  | "appleHealth"
  | "garmin";
export interface SettingsRowProps {
  icon: LucideIcon;
  title: string;
  onPress: () => void;
  selected?: boolean;
}
export interface ApiKeySummary {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}
export interface CreatedApiKey extends ApiKeySummary {
  key: string;
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
  | "lookingForAp"
  | "description"
  | "reactionEmojis"
  | "delete";
