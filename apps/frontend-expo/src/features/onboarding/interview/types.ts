import type { ReactNode } from "react";
import type {
  InterviewResult,
  InterviewStage,
  InterviewFacts,
} from "@tsw/prisma/follow-through";
export interface InterviewFrameProps {
  stage: InterviewStage;
  progress?: { current: number; total: number; label: string };
  preview: boolean;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  backDisabled?: boolean;
  children: ReactNode;
  actions: ReactNode;
}
export interface PlanSummaryProps {
  facts: InterviewFacts;
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
