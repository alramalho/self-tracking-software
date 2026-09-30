import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import type {
  InterviewResult,
  InterviewStage,
  InterviewFacts,
} from "@tsw/prisma/follow-through";
export interface InterviewFrameProps {
  stage: InterviewStage;
  transitionKey?: string;
  progress?: { current: number; total: number; label: string };
  preview: boolean;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  // Skippable steps show "Skip" where the close button would be.
  onSkip?: () => void;
  // Welcome and match screens: no back, no progress line.
  bare?: boolean;
  backInBare?: boolean;
  backDisabled?: boolean;
  children: ReactNode;
  actions: ReactNode;
}

export type OnboardingArtName =
  | "welcome"
  | "goal"
  | "baseline"
  | "motivation"
  | "rhythm"
  | "support"
  | "circle"
  | "match"
  | "review";

export interface OnboardingArtSource {
  still: number;
  motion?: number;
}

export interface OnboardingArtProps {
  name: OnboardingArtName;
  size?: number;
}

export interface FooterFadeProps {
  color: string;
}

export interface FloatingProps {
  children: ReactNode;
}
export interface PlanSummaryProps {
  facts: InterviewFacts;
  // "Find one · nearby, age", "Invite friends" or "Just me".
  circle?: string;
}

export interface CoachValidationProps {
  loading: boolean;
  result?: InterviewResult;
  stage: InterviewStage;
  strategist: boolean;
  onMessageRendered: () => void;
}

export interface WordRevealProps {
  children: string;
  onComplete: () => void;
}

export interface AutoContinueActionProps {
  label: string;
  onContinue: () => void;
}

export interface CoachSuggestionProps {
  message: string;
}

export interface WeeklyFrequencyPickerProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export interface StepRevealProps {
  children: ReactNode;
  order: number;
  name: string;
  style?: StyleProp<ViewStyle>;
}
export interface StepSequenceProps extends ViewProps {
  children: ReactNode;
  start?: number;
  prefix: string;
}

export interface NumberPickerProps extends WeeklyFrequencyPickerProps {
  min: number;
  max: number;
  unit: string;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel: string;
  testID: string;
  valueTestID?: string;
}
