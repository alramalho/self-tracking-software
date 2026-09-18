import type { ComponentType, ReactNode, RefObject } from "react";
import type { View } from "react-native";
import type { HealthWorkoutPreview } from "../workout-types";

export type WorkoutShareStatsCount = 3 | 6;
export type WorkoutSharePalette = "sunset" | "lime" | "violet" | "ice";
export type WorkoutShareOrientation = "portrait" | "landscape";

export interface WorkoutShareOptions {
  statsCount: WorkoutShareStatsCount;
  palette: WorkoutSharePalette;
  orientation: WorkoutShareOrientation;
}

export interface WorkoutShareCardProps {
  workout: HealthWorkoutPreview;
  options: WorkoutShareOptions;
  captureRef?: RefObject<View | null>;
}

export interface ShareWorkoutCardInput {
  view: RefObject<View | null>;
  title: string;
}

export interface WorkoutShareProps {
  workout: HealthWorkoutPreview;
}

export interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  swatch?: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
}

export interface ControlRowProps {
  title: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  children: ReactNode;
}
