import type { ReactNode } from "react";
import type { Activity, Photo } from "@/core/types";

export interface LoggingDrawerProps {
  testID?: string;
  dismissLabel?: string;
  title?: string;
  titleAlign?: "left" | "center";
  contentPadding?: number;
  keyboardToolbar?: boolean;
  scrollToEndOnKeyboard?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export interface LoggingCalendarProps {
  value: Date;
  onChange: (date: Date) => void;
  variant?: "compact" | "large";
}

export interface QuantityStepProps {
  activity: Activity;
  date: string;
  quantity: string;
  onDateChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onNext: () => void;
}

export interface PhotoStepProps {
  photos: Photo[];
  caption: string;
  busy: boolean;
  picking: boolean;
  uploadProgress?: number;
  onCaptionChange: (value: string) => void;
  onAddPhotos: (camera?: boolean) => void;
  onRemovePhoto: (index: number) => void;
  onSave: () => void;
  onBack: () => void;
  children: ReactNode;
}

export interface DifficultyStepProps {
  activity: Activity;
  entryId: string;
  initialNotes: string;
  onSkip: () => void;
  onSave: (difficulty: string, notes?: string) => Promise<void>;
}
