import type { LucideIcon } from "lucide-react-native";
import type { HealthWorkoutPreview } from "../workout-types";
export type ReviewPage = "workout" | "choose" | "quantity" | "privacy";
export interface ReviewRowProps {
  title: string;
  detail?: string;
  label?: string;
  icon?: LucideIcon;
  emoji?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
export interface ReviewLinkProps {
  label: string;
  back?: boolean;
  disabled?: boolean;
  onPress: () => void;
}
export interface DetectedWorkoutCardProps {
  workout: HealthWorkoutPreview;
}
