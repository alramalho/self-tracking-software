import type { ReactNode } from "react";

export interface DrawerProps {
  visible: boolean;
  /** Read by screen readers for the close button; the visible title is DrawerHeader's. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export interface DrawerHeaderProps {
  emoji?: string | null;
  title: string;
  /** One short line at most. */
  subtitle?: string | null;
}

export interface DrawerOption {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Replaces the chevron, e.g. a Switch. */
  trailing?: ReactNode;
  testID?: string;
}

export interface DrawerOptionsProps {
  /** Small label above the card, e.g. "What got in the way?". */
  label?: string;
  options: DrawerOption[];
}

export interface DrawerButtonProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}
