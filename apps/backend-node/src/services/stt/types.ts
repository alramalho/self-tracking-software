export interface STTConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  provider: "OpenAI" | "OpenRouter";
}

export interface Transcript {
  text: string;
  /** ISO 639-1 code of the language the model heard, when it reports one. */
  language?: string;
  model: string;
}

export interface TimestampedTranscript {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export type TranscriptionFeedbackReason =
  | "WRONG_LANGUAGE"
  | "WRONG_WORDS"
  | "OTHER";

export interface TranscriptionFeedback {
  helpful: boolean;
  reason?: TranscriptionFeedbackReason;
  comment?: string;
  transcript?: string;
  language?: string;
  model?: string;
}
