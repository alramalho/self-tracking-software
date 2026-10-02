export interface DictationButtonProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onBusyChange?: (busy: boolean) => void;
  onError: (error: unknown) => void;
  onTranscript: (transcript: string) => void;
  /** Called with every result, so the screen can ask whether it was right. */
  onTranscription?: (transcription: Transcription) => void;
}

export interface Transcription {
  text: string;
  /** ISO 639-1 code of the language the model heard. */
  language?: string;
  model?: string;
}

export interface TranscriptionResponse extends Transcription {
  success: boolean;
}

export type TranscriptionFeedbackReason =
  | "WRONG_LANGUAGE"
  | "WRONG_WORDS"
  | "OTHER";

export interface TranscriptionFeedbackInput {
  helpful: boolean;
  reason?: TranscriptionFeedbackReason;
  comment?: string;
  transcript?: string;
  language?: string;
  model?: string;
}

export interface TranscriptionFeedbackProps {
  transcription: Transcription;
  onDone: () => void;
}

export interface WhatWentWrongProps {
  busy: boolean;
  error: unknown;
  onSend: (reason?: TranscriptionFeedbackReason, comment?: string) => void;
  onClose: () => void;
}

export interface LanguagesDrawerProps {
  onClose: () => void;
}

export interface SpokenLanguage {
  code: string;
  name: string;
  /** The language's own name, shown beside the English one. */
  native: string;
}
