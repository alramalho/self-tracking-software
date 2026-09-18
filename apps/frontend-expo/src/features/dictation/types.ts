export interface DictationButtonProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onBusyChange?: (busy: boolean) => void;
  onError: (error: unknown) => void;
  onTranscript: (transcript: string) => void;
}

export interface TranscriptionResponse {
  text: string;
  success: boolean;
}
