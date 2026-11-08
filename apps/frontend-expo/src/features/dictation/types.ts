export interface DictationButtonProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  /** Drop the tinted tile when the button sits inside another field. */
  quiet?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onError: (error: unknown) => void;
  onTranscript: (transcript: string) => void;
}

export interface TranscriptionResponse {
  text: string;
  success: boolean;
}
