import type { ReactNode } from "react";
export interface EntranceProps {
  children: ReactNode;
  delay?: number;
  spring?: boolean;
}
export interface FollowUpHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
}
export interface FollowUpActionsProps {
  onSkip: () => void;
  onDone: () => void;
  busy?: boolean;
  disabled?: boolean;
}
