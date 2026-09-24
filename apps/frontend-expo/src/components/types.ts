import type { ReactNode } from "react";
import type { TextInputProps, ViewStyle, StyleProp } from "react-native";
export interface GroupedRow {
  id: string;
  icon: string;
  title: string;
  value: string;
  /** Needs the person's attention: accent dot and value. */
  attention?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}
export interface GroupedRowsProps {
  rows: GroupedRow[];
  testID?: string;
}
export interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
export interface ButtonProps {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
  testID?: string;
}
export interface FieldProps extends TextInputProps {
  label: string;
}
export interface ScreenProps {
  testID?: string;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
  leading?: ReactNode;
}
export interface StatusProps {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
  secondaryAction?: StatusAction;
  empty?: string;
}
export interface StatusAction {
  label: string;
  onPress: () => void;
}
export interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}
export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
  includeTime?: boolean;
}

export interface IconButtonProps {
  disabled?: boolean;
  label: string;
  icon: import("lucide-react-native").LucideIcon;
  onPress: () => void;
  testID?: string;
}
