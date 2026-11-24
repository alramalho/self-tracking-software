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
  /** Full-screen layer over the sheet, inside its modal (the log celebration): iOS can't present a second modal on top. */
  overlay?: ReactNode;
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
  /** What the session was about, when the mic filled it in. */
  description?: string;
  onDateChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onVoiceFill: (fill: VoiceFill) => void;
  onNext: () => void;
}

/** What a spoken note filled in on the log screen. */
export interface VoiceFill {
  quantity: number;
  /** YYYY-MM-DD, and HH:mm when they said a time. */
  date: string;
  time?: string | null;
  description: string;
}

export interface VoiceFillButtonProps {
  activity: Activity;
  onFill: (fill: VoiceFill) => void;
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
