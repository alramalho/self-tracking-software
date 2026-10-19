import type { TextInputProps } from "react-native";
import type { Activity } from "@/core/types";
import type { LucideIcon } from "lucide-react-native";
export interface ActivityEditorProps {
  activity?: Activity;
  onClose: () => void;
  /** Called instead of creating a duplicate, with the activity the person already has. */
  onUseExisting?: (activity: Activity) => void;
}
export type EditorStep = "edit" | "measure" | "delete" | "merge";
/** One side's logs are multiplied by `factor` to count in `to`, e.g. Hiking's hours into minutes. */
export interface LogConversion {
  activityId: string;
  from: string;
  to: string;
  factor: number;
}
/** Another activity that is the same habit, and what merging the two would move. */
export interface MergeSuggestion {
  match: "name" | "meaning";
  keep: Activity;
  remove: Activity;
  entriesToMove: number;
  plansToUpdate: number;
  conversion: LogConversion | null;
}
export interface DuplicateHintProps {
  activity: Activity;
  label: string;
  action: string;
  disabled?: boolean;
  onPress: () => void;
}
export interface ActivityLineProps {
  activity: Activity;
  note: string;
  faded?: boolean;
}
export interface MergeStepProps {
  suggestion: MergeSuggestion;
}
export type ConversionOperator = "multiply" | "divide";
export interface EditorAction {
  kind: "save" | "delete" | "merge";
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
