import type { TextInputProps } from "react-native";
import type { Activity } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
export interface ActivityEditorProps {
  activity?: Activity;
  onClose: () => void;
}
export type EditorStep = "edit" | "measure" | "delete";
export type ConversionOperator = "multiply" | "divide";
export interface EditorAction {
  kind: "save" | "delete";
  convert?: boolean;
}
export interface EditorInputProps extends TextInputProps {
  label: string;
}
export interface EditorButtonProps {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  secondary?: boolean;
  destructive?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}
export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}
export interface ColorOption {
  name: string;
  hex: string;
}
